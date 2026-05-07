from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.credit import CreditAccount, CreditPayment
from backend.models.customer import Customer
from backend.routes.deps import require_roles
from backend.schemas.customer import CustomerCreate, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


def _enrich(customer: Customer, db: Session) -> dict:
    """
    Compute correct accounting figures for a customer.

    balance = opening_balance + total_credit_transactions - total_payments
    """
    opening = float(customer.opening_balance or 0)

    total_credit = db.query(
        func.coalesce(func.sum(CreditAccount.total_amount), 0)
    ).filter(
        CreditAccount.party_type == "customer",
        CreditAccount.party_id == customer.id,
    ).scalar() or 0.0

    total_paid = db.query(
        func.coalesce(func.sum(CreditPayment.amount), 0)
    ).join(
        CreditAccount, CreditPayment.credit_account_id == CreditAccount.id
    ).filter(
        CreditAccount.party_type == "customer",
        CreditAccount.party_id == customer.id,
    ).scalar() or 0.0

    balance = opening + float(total_credit) - float(total_paid)

    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "address": customer.address,
        "email": customer.email,
        "opening_balance": opening,
        "notes": customer.notes,
        "created_at": customer.created_at,
        "total_credit": float(total_credit),
        "total_paid": float(total_paid),
        "balance": balance,
    }


@router.get("")
def list_customers(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    customers = db.query(Customer).order_by(Customer.name.asc()).all()
    return [_enrich(c, db) for c in customers]


def _validate_unique(db: Session, payload: CustomerCreate | CustomerUpdate, exclude_id: int | None = None):
    q_name = db.query(Customer).filter(func.lower(Customer.name) == payload.name.strip().lower())
    if exclude_id:
        q_name = q_name.filter(Customer.id != exclude_id)
    if q_name.first():
        raise ValueError("Customer with this name already exists")
    if payload.phone:
        q_phone = db.query(Customer).filter(Customer.phone == payload.phone.strip())
        if exclude_id:
            q_phone = q_phone.filter(Customer.id != exclude_id)
        if q_phone.first():
            raise ValueError("Customer with this phone already exists")


def _create(payload: CustomerCreate, db: Session) -> dict:
    _validate_unique(db, payload)
    row = Customer(
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
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return _create(payload, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_customer_alias(payload: CustomerCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return _create(payload, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _enrich(row, db)


@router.put("/{customer_id}")
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    try:
        _validate_unique(db, payload, exclude_id=customer_id)
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


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    has_credit = (
        db.query(CreditAccount)
        .filter(CreditAccount.party_type == "customer", CreditAccount.party_id == customer_id, CreditAccount.balance > 0)
        .first()
    )
    if has_credit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete customer with outstanding credit")
    db.delete(row)
    db.commit()
