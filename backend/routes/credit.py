import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.credit import (
    CustomerCreate, CustomerRead, CustomerUpdate,
    SupplierCreate, SupplierRead, SupplierUpdate,
)
from backend.services import customer_service, supplier_service

router = APIRouter(tags=["credit"])
logger = logging.getLogger("inventory-credit")


# ── Customers ─────────────────────────────────────────────────────────────────

@router.get("/customers", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return customer_service.list_customers(db)
    except Exception as exc:
        logger.error("list_customers failed: %s", exc)
        return []


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return customer_service.create_customer(db, payload)
    except Exception as exc:
        logger.error("create_customer failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/customers/{customer_id}", response_model=CustomerRead)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        c = customer_service.update_customer(db, customer_id, payload)
    except Exception as exc:
        logger.error("update_customer failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return c


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        ok = customer_service.delete_customer(db, customer_id)
    except Exception as exc:
        logger.error("delete_customer failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")


@router.get("/customers/{customer_id}/ledger")
def customer_ledger(customer_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        ledger = customer_service.get_customer_ledger(db, customer_id)
    except Exception as exc:
        logger.error("customer_ledger failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    if not ledger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return ledger


# ── Suppliers ─────────────────────────────────────────────────────────────────

@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return supplier_service.list_suppliers(db)
    except Exception as exc:
        logger.error("list_suppliers failed: %s", exc)
        return []


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return supplier_service.create_supplier(db, payload)
    except Exception as exc:
        logger.error("create_supplier failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/suppliers/{supplier_id}", response_model=SupplierRead)
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        s = supplier_service.update_supplier(db, supplier_id, payload)
    except Exception as exc:
        logger.error("update_supplier failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return s


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        ok = supplier_service.delete_supplier(db, supplier_id)
    except Exception as exc:
        logger.error("delete_supplier failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")


@router.get("/suppliers/{supplier_id}/ledger")
def supplier_ledger(supplier_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        ledger = supplier_service.get_supplier_ledger(db, supplier_id)
    except Exception as exc:
        logger.error("supplier_ledger failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    if not ledger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return ledger
