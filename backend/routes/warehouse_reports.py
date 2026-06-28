from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import warehouse_reports_service as wr

router = APIRouter(prefix="/warehouse-reports", tags=["warehouse-reports"])


REPORT_FUNCTIONS = {
    # GROUP 1: Stock
    "r101": ("Current Stock", wr.r101_current_stock),
    "r102": ("Stock Movements", wr.r102_stock_movements),
    "r103": ("Opening / Closing Stock", wr.r103_opening_closing),
    "r104": ("Stock Valuation", wr.r104_stock_valuation),
    "r105": ("Low Stock Alerts", wr.r105_low_stock),
    "r106": ("Damage Report", wr.r106_damage_report),
    "r107": ("Stock Ledger", wr.r107_stock_ledger),
    # GROUP 2: Salesman
    "r201": ("Salesman Performance", wr.r201_salesman_performance),
    "r202": ("Salesman Deliveries", wr.r202_salesman_deliveries),
    "r203": ("Salesman Collections", wr.r203_salesman_collections),
    "r204": ("Salesman Outstanding", wr.r204_salesman_outstanding),
    "r205": ("Salesman Area Coverage", wr.r205_salesman_area),
    # GROUP 3: Shop
    "r301": ("Shop Purchase History", wr.r301_shop_purchases),
    "r302": ("Shop Outstanding", wr.r302_shop_outstanding),
    "r303": ("Shop Ledger", wr.r303_shop_ledger),
    "r304": ("Top Shops", wr.r304_top_shops),
    "r305": ("Shop Returns", wr.r305_shop_returns),
    # GROUP 4: Invoice
    "r401": ("Invoice List", wr.r401_invoice_list),
    "r402": ("Daily Delivery", wr.r402_daily_delivery),
    "r403": ("Product Sales", wr.r403_product_sales),
    "r404": ("Discount Report", wr.r404_discount_report),
    # GROUP 5: Payment
    "r501": ("Daily Collection", wr.r501_daily_collection),
    "r502": ("Payment History", wr.r502_payment_history),
    "r503": ("Outstanding Aging", wr.r503_aging),
    "r504": ("Cash Flow", wr.r504_cashflow),
    # GROUP 6: Transfer / Return
    "r601": ("Transfer Report", wr.r601_transfers),
    "r602": ("Returns Combined", wr.r602_returns_combined),
    # GROUP 7: Finance
    "r701": ("Trial Balance", wr.r701_trial_balance),
    "r702": ("Journal Entries", wr.r702_journal_entries),
    "r703": ("Account Ledger", wr.r703_account_ledger),
    "r704": ("Profit & Loss", wr.r704_profit_loss),
}


@router.get("/{report_id}")
def run_report(
    report_id: str,
    warehouse_id: int = Query(None),
    product_id: int = Query(None),
    salesman_id: int = Query(None),
    shop_id: int = Query(None),
    category: str = Query(None),
    movement_type: str = Query(None),
    return_type: str = Query(None),
    payment_mode: str = Query(None),
    status: str = Query(None),
    aging: str = Query(None),
    min_balance: float = Query(None),
    area: int = Query(None),
    source_id: int = Query(None),
    dest_id: int = Query(None),
    account_id: int = Query(None),
    as_of: str = Query(None),
    date_str: str = Query(None),
    start: str = Query(None),
    end: str = Query(None),
    days: int = Query(None),
    top_n: int = Query(20),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    entry = REPORT_FUNCTIONS.get(report_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report '{report_id}' not found")
    label, fn = entry

    kwargs = {}
    sig = fn.__code__.co_varnames[: fn.__code__.co_argcount]
    all_params = {
        "db": db,
        "warehouse_id": warehouse_id,
        "product_id": product_id,
        "salesman_id": salesman_id,
        "shop_id": shop_id,
        "category": category,
        "movement_type": movement_type,
        "return_type": return_type,
        "payment_mode": payment_mode,
        "status": status,
        "aging": aging,
        "min_balance": min_balance,
        "area": area,
        "source_id": source_id,
        "dest_id": dest_id,
        "account_id": account_id,
        "as_of": as_of,
        "date_str": date_str,
        "start": start,
        "end": end,
        "days": days,
        "top_n": top_n,
    }
    for k in sig:
        if k in all_params and all_params[k] is not None:
            kwargs[k] = all_params[k]

    result = fn(**kwargs)
    if isinstance(result, dict) and "data" in result:
        result["report_id"] = report_id
        result["report_label"] = label
    return result


@router.get("/")
def list_reports():
    groups = {
        "stock": {"label": "Stock Reports", "reports": []},
        "salesman": {"label": "Salesman Reports", "reports": []},
        "shop": {"label": "Shop Reports", "reports": []},
        "invoice": {"label": "Invoice Reports", "reports": []},
        "payment": {"label": "Payment Reports", "reports": []},
        "transfer": {"label": "Transfer & Return Reports", "reports": []},
        "finance": {"label": "Finance / COA Reports", "reports": []},
    }
    group_map = {
        "r1": "stock", "r2": "salesman", "r3": "shop",
        "r4": "invoice", "r5": "payment", "r6": "transfer", "r7": "finance",
    }
    for rid, (label, _) in sorted(REPORT_FUNCTIONS.items()):
        prefix = rid[:2]
        g = group_map.get(prefix, "stock")
        groups[g]["reports"].append({"id": rid, "label": label})
    return groups
