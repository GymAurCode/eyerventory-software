from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Payment(Base):
    """
    Records cash settlements:
    - direction='receive': customer pays us  → Dr Cash / Cr Accounts Receivable
    - direction='pay':     we pay supplier   → Dr Accounts Payable / Cr Cash
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    direction = Column(String(10), nullable=False)   # 'receive' | 'pay'
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    amount = Column(Float, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    customer = relationship("Customer", back_populates="payments")
    supplier = relationship("Supplier")
