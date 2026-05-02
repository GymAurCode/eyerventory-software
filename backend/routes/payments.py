import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.payment import PaymentCreate, PaymentRead
from backend.services import payment_service

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger("inventory-payments")


@router.get("", response_model=list[PaymentRead])
def list_payments(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return payment_service.list_payments(db)
    except Exception as exc:
        logger.error("list_payments failed: %s", exc)
        return []


@router.post("", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return payment_service.create_payment(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("create_payment failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
