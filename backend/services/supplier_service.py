from sqlalchemy.orm import Session

from backend.models.payment import Payment
from backend.models.purchase import Purchase
from backend.models.supplier import Supplier
from backend.schemas.credit import SupplierCreate, SupplierUpdate


def create_supplier(db: Session, payload: SupplierCreate) -> Supplier:
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def list_suppliers(db: Session):
    return db.query(Supplier).order_by(Supplier.name).all()


def get_supplier(db: Session, supplier_id: int):
    return db.query(Supplier).filter(Supplier.id == supplier_id).first()


def update_supplier(db: Session, supplier_id: int, payload: SupplierUpdate):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        return None
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(supplier, k, v)
    db.commit()
    db.refresh(supplier)
    return supplier


def delete_supplier(db: Session, supplier_id: int) -> bool:
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        return False
    db.delete(supplier)
    db.commit()
    return True


def get_supplier_ledger(db: Session, supplier_id: int) -> dict:
    """
    Build a running-balance ledger for a supplier.
    Credit purchases increase payable; payments decrease it.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        return None

    purchases = db.query(Purchase).filter(
        Purchase.supplier_id == supplier_id,
        Purchase.payment_type == "credit",
    ).order_by(Purchase.created_at).all()

    payments = db.query(Payment).filter(
        Payment.supplier_id == supplier_id,
        Payment.direction == "pay",
    ).order_by(Payment.created_at).all()

    entries = []
    for p in purchases:
        entries.append({
            "date": p.created_at,
            "description": f"Credit Purchase #{p.id}",
            "debit": 0.0,
            "credit": p.total_amount,   # payable increases
            "type": "purchase",
            "ref_id": p.id,
        })
    for p in payments:
        entries.append({
            "date": p.created_at,
            "description": f"Payment to Supplier #{p.id}",
            "debit": p.amount,          # payable decreases
            "credit": 0.0,
            "type": "payment",
            "ref_id": p.id,
        })

    entries.sort(key=lambda x: x["date"])

    running = 0.0
    ledger_rows = []
    for e in entries:
        running += e["credit"] - e["debit"]
        ledger_rows.append({**e, "balance": round(running, 2), "date": e["date"].isoformat()})

    return {
        "supplier": {"id": supplier.id, "name": supplier.name, "phone": supplier.phone},
        "opening_balance": 0.0,
        "entries": ledger_rows,
        "closing_balance": round(running, 2),
        "current_balance": round(supplier.balance, 2),
    }
