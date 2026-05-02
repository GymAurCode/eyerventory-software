<<<<<<< HEAD
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
=======
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Purchase(Base):
<<<<<<< HEAD
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_number = Column(String(80), nullable=False, unique=True, index=True)
    purchase_date = Column(DateTime(timezone=True), nullable=False)
    total_amount = Column(Float, nullable=False)       # sum of line items
    discount = Column(Float, nullable=False, default=0.0)
    tax = Column(Float, nullable=False, default=0.0)
    final_amount = Column(Float, nullable=False)       # total - discount + tax
    payment_type = Column(String(10), nullable=False)  # CASH | CREDIT
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    supplier = relationship("Supplier", backref="purchases")
=======
    """
    A purchase order from a supplier.
    payment_type: 'cash' | 'credit'
    """
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    payment_type = Column(String(10), nullable=False, default="cash")  # cash | credit
    total_amount = Column(Float, nullable=False, default=0.0)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    supplier = relationship("Supplier", back_populates="purchases")
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
<<<<<<< HEAD
=======
    """Individual line item within a purchase."""
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
<<<<<<< HEAD
    purchase_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)  # quantity * purchase_price

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product", backref="purchase_items")
=======
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
