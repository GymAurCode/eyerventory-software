from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import get_current_user, require_roles
from backend.schemas.hr_payment_schema import HRPaymentCreate, HRPaymentRead, PaymentReverseRequest
from backend.services import hr_payment_service

router = APIRouter(prefix="/hr-payments", tags=["hr-payments"])


@router.post("", response_model=HRPaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: HRPaymentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    return hr_payment_service.create_payment(db, payload, created_by=user.id)


@router.get("", response_model=list[HRPaymentRead])
def list_payments(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    payments = hr_payment_service.get_payments(db, employee_id=employee_id)
    result = []
    for p in payments:
        result.append({
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            "employee_name": p.employee.name if p.employee else None,
        })
    return result


@router.post("/reverse", status_code=status.HTTP_201_CREATED)
def reverse_payment(
    payload: PaymentReverseRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_roles("owner", "admin")),
):
    try:
        return hr_payment_service.reverse_payment(db, payload, reverser_id=user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
