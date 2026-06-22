import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.activity_log import ActivityLog
from backend.routes.deps import require_roles
from backend.utils.activity import time_ago

logger = logging.getLogger("inventory-activities")
router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("")
def list_activities(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    action_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    query = db.query(ActivityLog)
    if action_type:
        query = query.filter(ActivityLog.action_type == action_type)
    activities = (
        query.order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "action_type": a.action_type,
            "description": a.description,
            "reference_id": a.reference_id,
            "reference_type": a.reference_type,
            "amount": a.amount,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "time_ago": time_ago(a.created_at) if a.created_at else "",
        }
        for a in activities
    ]


@router.get("/low-stock")
def low_stock_items(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    from backend.models.product import Product

    threshold_col = Product.low_stock_threshold
    items = (
        db.query(Product)
        .filter(Product.stock <= threshold_col)
        .order_by(Product.stock.asc())
        .all()
    )
    return {
        "count": len(items),
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "quantity": p.stock,
                "low_stock_threshold": p.low_stock_threshold,
                "category": p.category,
            }
            for p in items
        ],
    }
