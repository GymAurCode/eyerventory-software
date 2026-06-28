from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import sales_breakdown_service

router = APIRouter(prefix="/sales-breakdown", tags=["sales-breakdown"])


@router.get("/monthly")
def get_monthly_breakdown(
    year: int = Query(),
    month: int = Query(ge=1, le=12),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    return sales_breakdown_service.get_monthly_breakdown(db, year, month)


@router.get("/weekly")
def get_weekly_breakdown(
    year: int = Query(),
    month: int = Query(ge=1, le=12),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    return sales_breakdown_service.get_weekly_breakdown(db, year, month)


@router.get("/trend")
def get_trend(
    months: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    return sales_breakdown_service.get_monthly_trend(db, months)
