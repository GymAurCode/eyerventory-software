from __future__ import annotations

from datetime import datetime

from backend.ai.observability import log_error


REQUIRED_SALE_FIELDS = {"product_id", "quantity", "created_at"}


def validate_sales_rows(rows: list[dict], context: str = "training") -> list[dict]:
    valid: list[dict] = []
    for row in rows:
        if not REQUIRED_SALE_FIELDS.issubset(row.keys()):
            log_error("invalid_row_schema", context=context, row=row)
            continue
        qty = row.get("quantity")
        dt = row.get("created_at")
        if qty is None or qty < 0:
            log_error("invalid_row_quantity", context=context, row=row)
            continue
        if not isinstance(dt, datetime):
            log_error("invalid_row_datetime", context=context, row=row)
            continue
        valid.append(row)
    return valid


def validate_prediction_output(item: dict) -> dict:
    item["future_demand"] = max(float(item.get("future_demand", 0.0)), 0.0)
    item["daily_demand"] = max(float(item.get("daily_demand", 0.0)), 0.0)
    if item.get("recommended_quantity") is not None:
        item["recommended_quantity"] = max(min(int(item["recommended_quantity"]), 100000), 0)
    return item

