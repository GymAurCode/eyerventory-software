"""
Payment Service — settle receivables and payables.

Receive from customer (direction='receive'):
    Dr Cash on Hand (asset)
    Cr Accounts Receivable (asset)   ← reduces the receivable

Pay supplier (direction='pay'):
    Dr Accounts Payable (liability)  ← reduces the payable
    Cr Cash on Hand (asset)
"""
from sqlalchemy.orm import Session

from backend.models.customer import Customer
from backend.models.payment import Payment
from backend.models.supplier import Supplier
from backend.schemas.payment import PaymentCreate
from backend.services.accounting_service import create_journal_entry


def create_payment(db: Session, payload: PaymentCreate) -> Payment:
    if payload.direction == "receive":
        if not payload.customer_id:
            raise ValueError("Receiving payment requires a customer")
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise ValueError("Customer not found")
        if payload.amount > customer.balance + 0.001:
            raise ValueError(
                f"Payment amount ({payload.amount}) exceeds outstanding balance ({customer.balance:.2f})"
            )

        payment = Payment(
            direction="receive",
            customer_id=payload.customer_id,
            amount=payload.amount,
            note=payload.note,
        )
        db.add(payment)
        db.flush()

        create_journal_entry(
            db=db,
            description=f"Payment received from {customer.name} — #{payment.id}",
            entries=[
                {"account_name": "Cash on Hand", "account_type": "asset", "debit": payload.amount, "credit": 0.0},
                {"account_name": "Accounts Receivable", "account_type": "asset", "debit": 0.0, "credit": payload.amount},
            ],
            reference_type="payment_receive",
            reference_id=payment.id,
        )
        customer.balance -= payload.amount

    elif payload.direction == "pay":
        if not payload.supplier_id:
            raise ValueError("Paying supplier requires a supplier")
        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise ValueError("Supplier not found")
        if payload.amount > supplier.balance + 0.001:
            raise ValueError(
                f"Payment amount ({payload.amount}) exceeds outstanding payable ({supplier.balance:.2f})"
            )

        payment = Payment(
            direction="pay",
            supplier_id=payload.supplier_id,
            amount=payload.amount,
            note=payload.note,
        )
        db.add(payment)
        db.flush()

        create_journal_entry(
            db=db,
            description=f"Payment to supplier {supplier.name} — #{payment.id}",
            entries=[
                {"account_name": "Accounts Payable", "account_type": "liability", "debit": payload.amount, "credit": 0.0},
                {"account_name": "Cash on Hand", "account_type": "asset", "debit": 0.0, "credit": payload.amount},
            ],
            reference_type="payment_pay",
            reference_id=payment.id,
        )
        supplier.balance -= payload.amount

    else:
        raise ValueError("direction must be 'receive' or 'pay'")

    db.commit()
    db.refresh(payment)
    return payment


def list_payments(db: Session):
    return db.query(Payment).order_by(Payment.id.desc()).all()
