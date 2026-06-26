from sqlalchemy import (
    CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    code = Column(String(20), nullable=True, unique=True)
    location = Column(String(255), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    stock_items = relationship("WarehouseStock", back_populates="warehouse", cascade="all, delete-orphan")


class WarehouseStock(Base):
    __tablename__ = "warehouse_stock"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "product_id", name="uq_warehouse_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    warehouse = relationship("Warehouse", back_populates="stock_items")
    product = relationship("Product", backref="warehouse_stock")


class StockLedger(Base):
    __tablename__ = "stock_ledger"
    __table_args__ = (
        CheckConstraint("transaction_type IN ('stock_in','stock_out','transfer_in','transfer_out','adjustment','return','damage','opening','sale')"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False, index=True)
    reference_type = Column(String(40), nullable=True)
    reference_id = Column(Integer, nullable=True)
    quantity = Column(Integer, nullable=False)
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=True)
    total_amount = Column(Float, nullable=True)
    description = Column(String(255), nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    product = relationship("Product", backref="stock_ledger_entries")
    warehouse = relationship("Warehouse", backref="stock_ledger_entries")


class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    __table_args__ = (
        CheckConstraint("transaction_type IN ('stock_in','stock_out','transfer','adjustment','return_supplier','damage','cycle_count')"),
    )

    id = Column(Integer, primary_key=True, index=True)
    transaction_no = Column(String(30), nullable=False, unique=True)
    transaction_type = Column(String(20), nullable=False, index=True)
    source_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    dest_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    reference_no = Column(String(80), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="completed")
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source_warehouse = relationship("Warehouse", foreign_keys=[source_warehouse_id])
    dest_warehouse = relationship("Warehouse", foreign_keys=[dest_warehouse_id])
    supplier = relationship("Supplier", backref="stock_transactions")
    items = relationship("StockTransactionItem", back_populates="transaction", cascade="all, delete-orphan")


class StockTransactionItem(Base):
    __tablename__ = "stock_transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("stock_transactions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=True)
    total_price = Column(Float, nullable=True)
    batch_no = Column(String(40), nullable=True)
    notes = Column(String(255), nullable=True)

    transaction = relationship("StockTransaction", back_populates="items")
    product = relationship("Product", backref="stock_transaction_items")


class DamageInventory(Base):
    __tablename__ = "damage_inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=True)
    reported_by = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", backref="damage_entries")
    warehouse = relationship("Warehouse", backref="damage_entries")


class CycleCount(Base):
    __tablename__ = "cycle_counts"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    count_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status = Column(String(20), nullable=False, default="draft")
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    warehouse = relationship("Warehouse", backref="cycle_counts")
    items = relationship("CycleCountItem", back_populates="cycle_count", cascade="all, delete-orphan")


class CycleCountItem(Base):
    __tablename__ = "cycle_count_items"

    id = Column(Integer, primary_key=True, index=True)
    cycle_count_id = Column(Integer, ForeignKey("cycle_counts.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    system_qty = Column(Integer, nullable=False)
    counted_qty = Column(Integer, nullable=False)
    variance = Column(Integer, nullable=False)
    notes = Column(String(255), nullable=True)

    cycle_count = relationship("CycleCount", back_populates="items")
    product = relationship("Product", backref="cycle_count_items")


class ClosingStock(Base):
    __tablename__ = "closing_stock"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    opening_qty = Column(Integer, nullable=False)
    inward_qty = Column(Integer, nullable=False, default=0)
    outward_qty = Column(Integer, nullable=False, default=0)
    closing_qty = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", backref="closing_stock_entries")
    warehouse = relationship("Warehouse", backref="closing_stock_entries")
