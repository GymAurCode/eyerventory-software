from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.sale import Sale


def _utc(dt: datetime | None) -> datetime:
    if not dt:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def load_sales_by_product(db: Session) -> dict[int, list[dict]]:
    rows = db.query(Sale).order_by(Sale.created_at.asc()).all()
    grouped: dict[int, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row.product_id, []).append(
            {
                "product_id": row.product_id,
                "quantity": int(row.quantity or 0),
                "created_at": _utc(row.created_at),
            }
        )
    return grouped


def load_products(db: Session) -> list[dict]:
    rows = db.query(Product).order_by(Product.id.asc()).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "stock": int(row.stock or 0),
            "cost_price": float(row.cost_price or 0),
        }
        for row in rows
    ]

