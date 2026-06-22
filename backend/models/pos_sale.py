from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class PosSale(Base):
    __tablename__ = "pos_sales"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(20), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    subtotal = Column(Float, nullable=False, default=0)
    discount = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    payment_method = Column(String(16), nullable=False, default="cash")
    cash_received = Column(Float, nullable=True)
    change_amount = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items = relationship("PosSaleItem", back_populates="sale", cascade="all, delete-orphan")
    customer = relationship("Customer")
    returns = relationship("SaleReturn", back_populates="sale", cascade="all, delete-orphan")


class PosSaleItem(Base):
    __tablename__ = "pos_sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("pos_sales.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    item_name = Column(String(120), nullable=False)
    qty = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    sale = relationship("PosSale", back_populates="items")
    product = relationship("Product")


class SaleReturn(Base):
    __tablename__ = "sale_returns"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("pos_sales.id"), nullable=False)
    reason = Column(String(255), nullable=True)
    total_refund = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sale = relationship("PosSale", back_populates="returns")
    items = relationship("SaleReturnItem", back_populates="sale_return", cascade="all, delete-orphan")


class SaleReturnItem(Base):
    __tablename__ = "sale_return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("sale_returns.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    item_name = Column(String(120), nullable=False)
    qty = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    sale_return = relationship("SaleReturn", back_populates="items")
    product = relationship("Product")
