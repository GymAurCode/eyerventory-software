import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.purchase import PurchaseCreate, PurchaseRead
from backend.services import purchase_service

router = APIRouter(prefix="/purchases", tags=["purchases"])
logger = logging.getLogger("inventory-purchases")


@router.get("", response_model=list[PurchaseRead])
def list_purchases(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return purchase_service.list_purchases(db)
    except Exception as exc:
        logger.error("list_purchases failed: %s", exc)
        return []


@router.get("/{purchase_id}", response_model=PurchaseRead)
def get_purchase(purchase_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        p = purchase_service.get_purchase(db, purchase_id)
    except Exception as exc:
        logger.error("get_purchase failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    return p


@router.post("", response_model=PurchaseRead, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return purchase_service.create_purchase(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("create_purchase failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
