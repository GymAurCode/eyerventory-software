from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class HRPayment(Base):
    __tablename__ = "hr_payments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=True)
    amount = Column(Float, nullable=False)
    date = Column(String(10), nullable=False)           # "YYYY-MM-DD"
    method = Column(String(10), nullable=False)         # cash, bank
    note = Column(String(500), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_reversed = Column(Integer, default=0, nullable=False)  # 0=active, 1=reversed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="payments")
    payroll = relationship("Payroll", back_populates="payments")
    creator = relationship("User", foreign_keys=[created_by])
    reversal = relationship("PaymentReversal", back_populates="payment", uselist=False)


class PaymentReversal(Base):
    __tablename__ = "payment_reversals"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("hr_payments.id"), nullable=False)
    reversed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    payment = relationship("HRPayment", back_populates="reversal")
    reverser = relationship("User", foreign_keys=[reversed_by])
