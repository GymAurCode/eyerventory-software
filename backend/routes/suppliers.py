from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.credit import CreditAccount, Payment
from backend.models.supplier import Supplier
from backend.routes.deps import require_roles
from backend.schemas.supplier import SupplierCreate, SupplierUpdate

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def _enrich(supplier: Supplier, db: Session) -> dict:
    """
    Compute correct accounting figures for a supplier.

    balance = opening_balance + total_credit_transactions - total_payments
    """
    opening = float(supplier.opening_balance or 0)

    # Sum of all credit account totals for this supplier (transaction-based only)
    total_credit = db.query(
        func.coalesce(func.sum(CreditAccount.total_amount), 0)
    ).filter(
        CreditAccount.party_type == "supplier",
        CreditAccount.party_id == supplier.id,
    ).scalar() or 0.0

    # Sum of all payments made against those credit accounts
    total_paid = db.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).join(
        CreditAccount, Payment.credit_account_id == CreditAccount.id
    ).filter(
        CreditAccount.party_type == "supplier",
        CreditAccount.party_id == supplier.id,
    ).scalar() or 0.0

    balance = opening + float(total_credit) - float(total_paid)

    return {
        "id": supplier.id,
        "name": supplier.name,
        "phone": supplier.phone,
        "address": supplier.address,
        "email": supplier.email,
        "opening_balance": opening,
        "notes": supplier.notes,
        "created_at": supplier.created_at,
        # Computed fields
        "total_credit": float(total_credit),
        "total_paid": float(total_paid),
        "balance": balance,
    }


@router.get("")
def list_suppliers(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    suppliers = db.query(Supplier).order_by(Supplier.name.asc()).all()
    return [_enrich(s, db) for s in suppliers]


def _validate_unique(db: Session, payload: SupplierCreate | SupplierUpdate, exclude_id: int | None = None):
    q_name = db.query(Supplier).filter(func.lower(Supplier.name) == payload.name.strip().lower())
    if exclude_id:
        q_name = q_name.filter(Supplier.id != exclude_id)
    if q_name.first():
        raise ValueError("Supplier with this name already exists")
    if payload.phone:
        q_phone = db.query(Supplier).filter(Supplier.phone == payload.phone.strip())
        if exclude_id:
            q_phone = q_phone.filter(Supplier.id != exclude_id)
        if q_phone.first():
            raise ValueError("Supplier with this phone already exists")


def _create(payload: SupplierCreate, db: Session) -> dict:
    _validate_unique(db, payload)
    row = Supplier(
        name=payload.name.strip(),
        phone=(payload.phone or "").strip() or None,
        address=(payload.address or "").strip() or None,
        email=(payload.email or "").strip() or None,
        opening_balance=float(payload.opening_balance),
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _enrich(row, db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return _create(payload, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_supplier_alias(payload: SupplierCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return _create(payload, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{supplier_id}")
def get_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    row = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return _enrich(row, db)


@router.put("/{supplier_id}")
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    row = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    try:
        _validate_unique(db, payload, exclude_id=supplier_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    row.name = payload.name.strip()
    row.phone = (payload.phone or "").strip() or None
    row.address = (payload.address or "").strip() or None
    row.email = (payload.email or "").strip() or None
    row.opening_balance = float(payload.opening_balance)
    row.notes = (payload.notes or "").strip() or None
    db.commit()
    db.refresh(row)
    return _enrich(row, db)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    row = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    has_credit = (
        db.query(CreditAccount)
        .filter(CreditAccount.party_type == "supplier", CreditAccount.party_id == supplier_id, CreditAccount.balance > 0)
        .first()
    )
    if has_credit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete supplier with outstanding credit")
    db.delete(row)
    db.commit()
