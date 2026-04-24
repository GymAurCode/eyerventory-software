from typing import Optional

from sqlalchemy.orm import Session

from backend.core.security import verify_password
from backend.models.hr_payment import HRPayment, PaymentReversal
from backend.models.user import User
from backend.schemas.hr_payment_schema import HRPaymentCreate, PaymentReverseRequest


def create_payment(db: Session, payload: HRPaymentCreate, created_by: int) -> HRPayment:
    payment = HRPayment(
        employee_id=payload.employee_id,
        payroll_id=payload.payroll_id,
        amount=payload.amount,
        date=payload.date,
        method=payload.method,
        note=payload.note,
        created_by=created_by,
        is_reversed=0,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def get_payments(db: Session, employee_id: Optional[int] = None) -> list[HRPayment]:
    q = db.query(HRPayment)
    if employee_id:
        q = q.filter(HRPayment.employee_id == employee_id)
    return q.order_by(HRPayment.id.desc()).all()


def reverse_payment(db: Session, payload: PaymentReverseRequest, reverser_id: int) -> PaymentReversal:
    """
    Reverse a payment. Requires admin password verification.
    Never deletes — creates a reversal record and marks payment as reversed.
    """
    # Verify admin password
    admin = db.query(User).filter(User.id == reverser_id).first()
    if not admin:
        raise ValueError("User not found")
    if not verify_password(payload.admin_password, admin.hashed_password):
        raise ValueError("Invalid admin password")

    payment = db.query(HRPayment).filter(HRPayment.id == payload.payment_id).first()
    if not payment:
        raise ValueError("Payment not found")
    if payment.is_reversed:
        raise ValueError("Payment is already reversed")

    # Mark payment as reversed
    payment.is_reversed = 1

    # Create reversal record
    reversal = PaymentReversal(
        payment_id=payment.id,
        reversed_by=reverser_id,
        reason=payload.reason,
    )
    db.add(reversal)
    db.commit()
    db.refresh(reversal)
    return reversal
