from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.warehouse import PaymentCreate, PaymentRead
from backend.services import warehouse_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=list[PaymentRead])
def list_payments(
    shop_id: int = Query(None),
    salesman_id: int = Query(None),
    invoice_id: int = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_payments(
        db, shop_id=shop_id, salesman_id=salesman_id, invoice_id=invoice_id,
    )


@router.post("", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def record_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.record_payment(db, payload.model_dump())


@router.get("/daily-collection")
def daily_collection(
    date: str = Query(None),
    salesman_id: int = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_daily_collection(db, date=date, salesman_id=salesman_id)
