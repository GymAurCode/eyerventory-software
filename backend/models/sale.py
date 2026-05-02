from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    selling_price = Column(Float, nullable=False)
    revenue = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    profit = Column(Float, nullable=False)
<<<<<<< HEAD
    payment_type = Column(String(16), nullable=False, server_default="CASH")
    paid_amount = Column(Float, nullable=False, server_default="0")
    due_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product")
    customer = relationship("Customer")

    @property
    def due_amount(self) -> float:
        return float(self.revenue or 0) - float(self.paid_amount or 0)
=======
    # Credit sale support
    payment_type = Column(String(10), nullable=False, default="cash")  # cash | credit
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product")
    customer = relationship("Customer", back_populates="sales")
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
