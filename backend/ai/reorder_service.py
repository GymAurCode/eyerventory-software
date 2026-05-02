from datetime import datetime, timedelta, timezone
from statistics import mean

import numpy as np
from sqlalchemy.orm import Session

from backend.ai.cache import TTLCache
from backend.ai.data_validation import validate_prediction_output
from backend.ai.data_access import load_products, load_sales_by_product
from backend.ai.observability import track_latency, log_event, log_error
from backend.models.supplier_product_price import SupplierProductPrice

_cache = TTLCache(ttl_seconds=120)


def _urgency(days_to_stockout: float | None) -> str:
    if days_to_stockout is None:
        return "low"
    if days_to_stockout <= 5:
        return "high"
    if days_to_stockout <= 14:
        return "medium"
    return "low"


def _eoq(annual_demand: float, order_cost: float = 40.0, hold_cost_ratio: float = 0.2, unit_cost: float = 1.0) -> int:
    hold_cost = max(unit_cost * hold_cost_ratio, 0.01)
    value = ((2 * annual_demand * order_cost) / hold_cost) ** 0.5
    return max(int(round(value)), 1)


def _calculate_historical_demand(sales_data: list[dict], days: int = 30) -> float:
    """Calculate average daily demand from historical sales data."""
    if not sales_data:
        return 0.0
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    recent_sales = [
        s for s in sales_data
        if isinstance(s.get("created_at"), datetime) and s["created_at"] >= cutoff_date
    ]
    
    if not recent_sales:
        return 0.0
    
    total_quantity = sum(float(s.get("quantity", 0)) for s in recent_sales)
    avg_daily = total_quantity / days
    return max(avg_daily, 0.0)


def suggest_reorders(db: Session, lead_days: int = 7, safety_factor: float = 1.65) -> dict:
    def _compute():
        with track_latency("reorder"):
            # Load all products and sales data
            products = load_products(db)
            sales_by_product = load_sales_by_product(db)
            
            # Load supplier prices
            prices = db.query(SupplierProductPrice).order_by(SupplierProductPrice.date.desc()).all()
            latest_prices: dict[int, dict] = {}
            for price in prices:
                if price.product_id not in latest_prices:
                    latest_prices[price.product_id] = {
                        "supplier_id": price.supplier_id,
                        "price": float(price.price),
                    }
            
            # Validate minimum data
            if len(products) < 3:
                log_event("reorder_insufficient_products", product_count=len(products))
                return {
                    "data": [],
                    "insight": "Insufficient data for reliable reorder suggestions",
                    "reasoning": f"Only {len(products)} products in system. Need at least 3 products for reliable analysis.",
                    "confidence": 0.0,
                    "warning": "Insufficient data for reliable AI insights"
                }
            
            output = []
            for product in products:
                # Business sanity checks
                if product.get("stock") is None or product["stock"] < 0:
                    log_error("invalid_stock_value", product_id=product["id"], stock=product.get("stock"))
                    continue
                
                current_stock = int(product["stock"])
                product_id = product["id"]
                
                # Calculate historical demand from last 30 days
                sales_history = sales_by_product.get(product_id, [])
                avg_daily_demand = _calculate_historical_demand(sales_history, days=30)
                
                # Skip products with very low demand (< 0.1 units/day on average)
                if avg_daily_demand < 0.1:
                    log_event("reorder_skipped_low_demand", 
                             product_id=product_id, 
                             avg_daily_demand=avg_daily_demand)
                    continue
                
                # Calculate reorder point: (avg_daily_demand × lead_time_days) + safety_stock
                demand_during_lead = avg_daily_demand * lead_days
                safety_stock = int(round(safety_factor * avg_daily_demand))
                reorder_point = int(round(demand_during_lead + safety_stock))
                
                # Only suggest reorder if current stock is below reorder point
                if current_stock > reorder_point:
                    log_event("reorder_not_needed",
                             product_id=product_id,
                             current_stock=current_stock,
                             reorder_point=reorder_point)
                    continue
                
                # Check if stock will run out within lead time
                days_until_stockout = None
                if avg_daily_demand > 0:
                    days_until_stockout = current_stock / avg_daily_demand
                    if days_until_stockout > lead_days:
                        log_event("reorder_not_urgent",
                                 product_id=product_id,
                                 days_until_stockout=days_until_stockout)
                        continue
                
                # Calculate reorder quantity
                annual_demand = avg_daily_demand * 365.0
                unit_price = latest_prices.get(product_id, {}).get("price", 1.0)
                eoq_qty = _eoq(annual_demand, unit_cost=unit_price)
                qty_to_reach_reorder = max(reorder_point - current_stock, 0)
                reorder_qty = max(eoq_qty, qty_to_reach_reorder + safety_stock)
                
                urgency = _urgency(days_until_stockout)
                supplier_data = latest_prices.get(product_id)
                risk_level = "high" if days_until_stockout and days_until_stockout <= 7 else ("medium" if days_until_stockout and days_until_stockout <= 14 else "low")
                
                # Debug logging
                log_event("reorder_calculation",
                         product_id=product_id,
                         current_stock=current_stock,
                         avg_daily_demand=round(avg_daily_demand, 3),
                         reorder_point=reorder_point,
                         demand_during_lead=round(demand_during_lead, 2),
                         safety_stock=safety_stock,
                         days_until_stockout=round(days_until_stockout, 1) if days_until_stockout else None)
                
                row = {
                    "product_id": product_id,
                    "product_name": product["name"],
                    "current_stock": current_stock,
                    "avg_daily_demand": round(avg_daily_demand, 3),
                    "reorder_point": reorder_point,
                    "safety_stock": safety_stock,
                    "recommended_quantity": min(max(int(reorder_qty), 1), 100000),
                    "urgency": urgency,
                    "days_until_stockout": round(days_until_stockout, 1) if days_until_stockout else None,
                    "supplier_id": supplier_data.get("supplier_id") if supplier_data else None,
                    "unit_price": supplier_data.get("price") if supplier_data else None,
                    "reorder_needed": True,
                    "risk_level": risk_level,
                    "reasoning": (
                        f"Avg daily demand: {avg_daily_demand:.3f} units. "
                        f"Reorder point = ({avg_daily_demand:.3f} × {lead_days}) + {safety_stock} = {reorder_point}. "
                        f"Current stock {current_stock} < reorder point {reorder_point}. "
                        f"Stock will run out in {days_until_stockout:.1f} days. "
                        f"Recommend ordering {int(reorder_qty)} units."
                    ),
                    "factors_used": ["historical_demand_30days", "lead_time", "safety_stock", "eoq", "supplier_price"],
                }
                output.append(validate_prediction_output(row))
            
            if not output:
                log_event("reorder_no_candidates")
                return {
                    "data": [],
                    "insight": "All products have adequate stock",
                    "reasoning": "No products require reordering at this time. Current stock levels are above reorder points.",
                    "confidence": 1.0,
                }
            
            # Sort by urgency and stock level
            output_sorted = sorted(
                output,
                key=lambda x: ({"high": 0, "medium": 1, "low": 2}[x["urgency"]], x["current_stock"])
            )
            
            # Calculate aggregated insights
            high_urgency = sum(1 for x in output_sorted if x["urgency"] == "high")
            total_recommended = sum(x["recommended_quantity"] for x in output_sorted)
            
            insight = (
                f"{len(output_sorted)} products need reordering. "
                f"{high_urgency} at HIGH urgency. "
                f"Total recommended order: {total_recommended} units."
            )
            
            return {
                "data": output_sorted,
                "insight": insight,
                "reasoning": f"Analysis based on historical demand from last 30 days and {lead_days}-day lead time with {safety_factor}x safety factor.",
                "confidence": 0.95,
            }

    result = _cache.get_or_set(f"reorder:{lead_days}:{safety_factor}", _compute)
    # Ensure backward compatibility with routes expecting "items" key
    if isinstance(result, dict) and "data" in result:
        return result
    return {"items": result}

