from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
from sqlalchemy.orm import Session

from backend.ai.cache import TTLCache
from backend.ai.data_preprocessing import PreprocessConfig, aggregate_sales
from backend.ai.data_validation import validate_prediction_output, validate_sales_rows
from backend.ai.feature_engineering import feature_columns
from backend.ai.model_store import load_product_model
from backend.ai.observability import log_error, record_prediction, track_latency, log_event
from backend.ai.data_access import load_products, load_sales_by_product

_cache = TTLCache(ttl_seconds=120)


def _safe(values: list[float], idx: int) -> float:
    if idx < 0 or idx >= len(values):
        return 0.0
    return float(values[idx])


def _build_next_feature(values: list[float], date: datetime, t_idx: int):
    day_of_year = date.timetuple().tm_yday
    season_sin = np.sin(2 * np.pi * day_of_year / 365.25)
    season_cos = np.cos(2 * np.pi * day_of_year / 365.25)
    prev7 = values[-7:] if len(values) >= 7 else values
    prev14 = values[-14:] if len(values) >= 14 else values
    return np.array(
        [
            [
                t_idx,
                _safe(values, len(values) - 1),
                _safe(values, len(values) - 7),
                _safe(values, len(values) - 14),
                _safe(values, len(values) - 30),
                float(np.mean(prev7)) if prev7 else 0.0,
                float(np.std(prev7)) if prev7 else 0.0,
                float(np.mean(prev14)) if prev14 else 0.0,
                float(np.std(prev14)) if prev14 else 0.0,
                date.weekday(),
                date.month,
                season_sin,
                season_cos,
                _safe(values, len(values) - 1) - _safe(values, len(values) - 8),
            ]
        ],
        dtype=float,
    )


def _predict_arima(values: list[float], horizon_days: int, order: tuple[int, int, int] | None = None):
    if len(values) < 35:
        return None
    try:
        from statsmodels.tsa.arima.model import ARIMA

        fitted = ARIMA(values, order=order or (2, 1, 2)).fit()
        fc = np.maximum(np.array(fitted.forecast(steps=horizon_days), dtype=float), 0.0)
        residual_std = float(np.std(fitted.resid)) if hasattr(fitted, "resid") else float(np.std(values[-30:]))
        return fc.tolist(), residual_std
    except Exception as exc:
        log_error("arima_predict_failed", error=str(exc))
        return None


def _is_realistic_demand(daily_demand: float, current_stock: int) -> bool:
    """Check if predicted demand is realistic."""
    # Demand should be non-negative
    if daily_demand < 0:
        return False
    
    # Demand should not be impossibly large (more than 1000x current stock)
    if current_stock > 0 and daily_demand > current_stock * 1000:
        return False
    
    # Demand should be reasonable (not more than 10000 units per day for most products)
    if daily_demand > 10000:
        return False
    
    return True


def predict_stock(db: Session, horizon_days: int = 14) -> dict:
    def _compute():
        with track_latency("predict_stock"):
            sales_map = load_sales_by_product(db)
            products = load_products(db)
            
            # MINIMUM DATA VALIDATION
            if len(products) < 3:
                log_event("prediction_insufficient_products", product_count=len(products))
                return {
                    "data": [],
                    "insight": "Insufficient data for reliable demand predictions",
                    "reasoning": f"Only {len(products)} products in system. Need at least 3 products with sales history for reliable analysis.",
                    "confidence": 0.0,
                    "warning": "Insufficient data for reliable AI insights"
                }
            
            if len(sales_map) < 3:
                log_event("prediction_insufficient_sales", sales_entries=len(sales_map))
                return {
                    "data": [],
                    "insight": "Insufficient sales history for demand forecasting",
                    "reasoning": f"Only {len(sales_map)} products have sales data. Need more historical data for accurate predictions.",
                    "confidence": 0.0,
                    "warning": "Insufficient data for reliable AI insights"
                }
            
            result: list[dict] = []
            failed_count = 0
            
            for product in products:
                try:
                    # BUSINESS SANITY CHECK: Stock must not be negative
                    if product.get("stock") is None or product["stock"] < 0:
                        log_error("invalid_stock_negative", product_id=product["id"], stock=product.get("stock"))
                        failed_count += 1
                        continue
                    
                    history = validate_sales_rows(sales_map.get(product["id"], []), context="inference")
                    processed = aggregate_sales(history, PreprocessConfig(aggregate="daily"))
                    series = [float(point["quantity"]) for point in processed["series"]]
                    dates = [datetime.fromisoformat(f"{point['date']}T00:00:00") for point in processed["series"]]
                    
                    model_obj, metadata = load_product_model(product["id"])
                    model_meta = (metadata or {}).get("metadata", {})
                    algo = model_meta.get("algorithm")
                    forecast_seq = []
                    residual_std = float(model_meta.get("residual_std", np.std(series[-30:]) if series else 1.0))

                    try:
                        if algo == "arima":
                            arima_fc = _predict_arima(series, horizon_days)
                            if arima_fc is None:
                                raise ValueError("ARIMA inference failed")
                            forecast_seq, residual_std = arima_fc
                        elif model_obj is not None and len(series) >= 35:
                            seq = list(series)
                            next_date = dates[-1] if dates else datetime.utcnow()
                            for _ in range(horizon_days):
                                next_date = next_date + timedelta(days=1)
                                feature = _build_next_feature(seq, next_date, len(seq))
                                yhat = max(float(model_obj.predict(feature)[0]), 0.0)
                                seq.append(yhat)
                                forecast_seq.append(yhat)
                        else:
                            baseline = float(np.mean(series[-7:])) if series else 0.0
                            forecast_seq = [baseline for _ in range(horizon_days)]
                            residual_std = float(np.std(series[-30:])) if series else 1.0
                            algo = "fallback_baseline"
                    except Exception as exc:
                        log_error("prediction_failed_fallback", product_id=product["id"], error=str(exc))
                        baseline = float(np.mean(series[-7:])) if series else 0.0
                        forecast_seq = [baseline for _ in range(horizon_days)]
                        residual_std = float(np.std(series[-30:])) if series else 1.0
                        algo = "fallback_baseline"

                    total = float(np.sum(forecast_seq))
                    daily_demand = total / max(horizon_days, 1)
                    
                    # BUSINESS SANITY CHECK: Predicted demand must be realistic
                    if not _is_realistic_demand(daily_demand, int(product["stock"])):
                        log_error("unrealistic_demand", product_id=product["id"], daily_demand=daily_demand)
                        failed_count += 1
                        continue
                    
                    lower = max(total - 1.96 * residual_std * np.sqrt(max(horizon_days, 1)), 0.0)
                    upper = max(total + 1.96 * residual_std * np.sqrt(max(horizon_days, 1)), lower)
                    interval_width = upper - lower
                    confidence = float(np.exp(-interval_width / max(total + 1e-6, 1.0)))
                    
                    days_until_stockout = None
                    if daily_demand > 0:
                        days_until_stockout = round(product["stock"] / daily_demand, 1)
                    
                    # DEBUG LOGGING
                    log_event("prediction_calculated",
                             product_id=product["id"],
                             daily_demand=round(daily_demand, 3),
                             days_until_stockout=days_until_stockout,
                             method=algo,
                             confidence=round(confidence, 3))
                    
                    item = {
                        "product_id": product["id"],
                        "product_name": product["name"],
                        "current_stock": product["stock"],
                        "daily_demand": round(daily_demand, 3),
                        "horizon_days": horizon_days,
                        "future_demand": round(total, 2),
                        "days_until_stockout": days_until_stockout,
                        "confidence": round(max(min(confidence, 1.0), 0.01), 4),
                        "lower_bound": round(lower, 2),
                        "upper_bound": round(upper, 2),
                        "method": algo or "unknown",
                        "reasoning": (
                            f"Model {algo or 'unknown'} forecasted demand interval [{lower:.2f}, {upper:.2f}] "
                            f"using residual variance {residual_std:.3f}."
                        ),
                        "factors_used": feature_columns(),
                    }
                    record_prediction(item["method"])
                    result.append(validate_prediction_output(item))
                except Exception as exc:
                    log_error("prediction_product_error", product_id=product.get("id"), error=str(exc))
                    failed_count += 1
                    continue
            
            # Build response
            output_sorted = sorted(result, key=lambda item: item["days_until_stockout"] or 10**9)
            
            if not result:
                log_event("prediction_no_valid_results")
                return {
                    "data": [],
                    "insight": "No valid demand predictions available",
                    "reasoning": f"Failed to generate predictions for {len(products)} products.",
                    "confidence": 0.0,
                }
            
            # Generate summary insight
            critical_items = [p for p in output_sorted if p.get("days_until_stockout") and p["days_until_stockout"] <= 5]
            low_items = [p for p in output_sorted if p.get("days_until_stockout") and p["days_until_stockout"] <= 14]
            
            insight = (
                f"Generated demand forecast for {len(output_sorted)} products. "
                f"{len(critical_items)} at critical risk (≤5 days), {len(low_items)} at low stock (≤14 days)."
            )
            
            avg_confidence = round(np.mean([p["confidence"] for p in output_sorted]), 3)
            
            return {
                "data": output_sorted,
                "insight": insight,
                "reasoning": f"Forecasting {horizon_days}-day demand using ML models with {horizon_days} day horizon.",
                "confidence": avg_confidence,
                "summary": {
                    "total_predictions": len(output_sorted),
                    "critical_risk": len(critical_items),
                    "low_stock": len(low_items),
                    "failed_predictions": failed_count
                }
            }

    return _cache.get_or_set(f"prediction:{horizon_days}", _compute)


