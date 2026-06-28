from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import warehouse_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/stock-valuation")
def stock_valuation_report(
    warehouse_id: int = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_stock_valuation_report(db, warehouse_id=warehouse_id)


@router.get("/low-stock")
def low_stock_report(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_low_stock_report(db)


@router.get("/stock-movements")
def stock_movement_report(
    warehouse_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_stock_movement_report(
        db, warehouse_id=warehouse_id, start_date=start_date, end_date=end_date,
    )


@router.get("/damage")
def damage_report(
    warehouse_id: int = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_damage_report(db, warehouse_id=warehouse_id)


@router.get("/returns")
def return_report(
    warehouse_id: int = Query(None),
    return_type: str = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_return_report(
        db, warehouse_id=warehouse_id, return_type=return_type,
    )


@router.get("/salesman-performance")
def salesman_performance(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_salesman_performance(db)


@router.get("/shop-outstanding")
def shop_outstanding_report(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_shop_outstanding_report(db)


@router.get("/outstanding-aging")
def outstanding_aging_report(
    days: int = Query(30),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_outstanding_aging_report(db, days=days)


@router.get("/profit-loss")
def profit_loss_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_profit_loss_summary(db, start_date=start_date, end_date=end_date)
