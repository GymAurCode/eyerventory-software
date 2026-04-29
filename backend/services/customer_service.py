from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.customer import Customer
from backend.models.journal import JournalEntry, JournalItem
from backend.models.account import Account
from backend.models.payment import Payment
from backend.models.sale import Sale
from backend.schemas.credit import CustomerCreate, CustomerUpdate


def create_customer(db: Session, payload: CustomerCreate) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def list_customers(db: Session):
    return db.query(Customer).order_by(Customer.name).all()


def get_customer(db: Session, customer_id: int):
    return db.query(Customer).filter(Customer.id == customer_id).first()


def update_customer(db: Session, customer_id: int, payload: CustomerUpdate):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(customer, k, v)
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: int) -> bool:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return False
    db.delete(customer)
    db.commit()
    return True


def get_customer_ledger(db: Session, customer_id: int) -> dict:
    """
    Build a running-balance ledger for a customer from journal entries.
    Accounts Receivable entries linked to this customer's sales and payments.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None

    # Gather all sales (credit) for this customer
    sales = db.query(Sale).filter(Sale.customer_id == customer_id).order_by(Sale.created_at).all()
    # Gather all payments received from this customer
    payments = db.query(Payment).filter(
        Payment.customer_id == customer_id,
        Payment.direction == "receive",
    ).order_by(Payment.created_at).all()

    # Merge and sort by date
    entries = []
    for s in sales:
        entries.append({
            "date": s.created_at,
            "description": f"Credit Sale #{s.id}",
            "debit": s.revenue,   # amount owed increases
            "credit": 0.0,
            "type": "sale",
            "ref_id": s.id,
        })
    for p in payments:
        entries.append({
            "date": p.created_at,
            "description": f"Payment Received #{p.id}",
            "debit": 0.0,
            "credit": p.amount,   # amount owed decreases
            "type": "payment",
            "ref_id": p.id,
        })

    entries.sort(key=lambda x: x["date"])

    # Compute running balance
    running = 0.0
    ledger_rows = []
    for e in entries:
        running += e["debit"] - e["credit"]
        ledger_rows.append({**e, "balance": round(running, 2), "date": e["date"].isoformat()})

    return {
        "customer": {"id": customer.id, "name": customer.name, "phone": customer.phone},
        "opening_balance": 0.0,
        "entries": ledger_rows,
        "closing_balance": round(running, 2),
        "current_balance": round(customer.balance, 2),
    }
