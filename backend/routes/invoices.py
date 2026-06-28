from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.warehouse import InvoiceCreate, InvoiceDetail, InvoiceRead
from backend.services import warehouse_service

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=list[InvoiceRead])
def list_invoices(
    shop_id: int = Query(None),
    salesman_id: int = Query(None),
    warehouse_id: int = Query(None),
    status: str = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_invoices(
        db, shop_id=shop_id, salesman_id=salesman_id,
        warehouse_id=warehouse_id, status=status, limit=limit,
    )


@router.post("", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.create_invoice(db, payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.get_invoice_detail(db, invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{invoice_id}/print")
def get_invoice_print(
    invoice_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.get_invoice_detail(db, invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
