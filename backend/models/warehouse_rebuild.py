"""
Warehouse Module — Complete SQLAlchemy Models
===============================================
All tables for the Distributor Management System Warehouse Rebuild.

Conventions (matching existing codebase):
  - Snake_case table names, pluralized
  - PascalCase model classes
  - Integer PK named `id` with index=True
  - DateTime with timezone=True, server_default=func.now()
  - Strings with explicit max length
  - ForeignKey strings referencing "tablename.column"
  - Bidirectional relationships with back_populates
"""

from sqlalchemy import (
    CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


# ═══════════════════════════════════════════════════════════════════════════════
# [1] WAREHOUSE
# ═══════════════════════════════════════════════════════════════════════════════

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    code = Column(String(20), nullable=True, unique=True)
    location = Column(String(255), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    allow_negative_stock = Column(Integer, nullable=False, default=0)
    coa_mode = Column(String(20), nullable=False, default="separate")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    manager = relationship("Employee", backref="managed_warehouses", foreign_keys=[manager_id])

    # Rebuild-module relationships
    stock_items = relationship("WarehouseStock", back_populates="warehouse", cascade="all, delete-orphan")
    opening_stocks = relationship("OpeningStock", back_populates="warehouse", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="warehouse", foreign_keys="StockMovement.warehouse_id", cascade="all, delete-orphan")
    salesman_assignments = relationship("SalesmanWarehouse", back_populates="warehouse", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="warehouse")
    returns = relationship("Return", back_populates="warehouse")
    coa_accounts = relationship("WarehouseCOAAccount", back_populates="warehouse", cascade="all, delete-orphan")
    warehouse_journal_entries = relationship("WarehouseJournalEntry", back_populates="warehouse", cascade="all, delete-orphan")
    coa_setting = relationship("COASetting", back_populates="warehouse", uselist=False, cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════════════════
# [2] WAREHOUSE STOCK  (current on-hand quantity per product)
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# [3] OPENING STOCK
# ═══════════════════════════════════════════════════════════════════════════════

class OpeningStock(Base):
    __tablename__ = "opening_stock"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "product_id", name="uq_opening_warehouse_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False, default=0)
    rate = Column(Float, nullable=False, default=0)
    value = Column(Float, nullable=False, default=0)
    date = Column(DateTime(timezone=True), nullable=False)
    locked = Column(Integer, nullable=False, default=0)

    warehouse = relationship("Warehouse", back_populates="opening_stocks")
    product = relationship("Product", backref="opening_stocks")


# ═══════════════════════════════════════════════════════════════════════════════
# [4] STOCK MOVEMENTS  (unified audit log — every stock change in one place)
# ═══════════════════════════════════════════════════════════════════════════════
#
# movement_type values:
#   stock_in / stock_out / transfer_in / transfer_out /
#   damage / adjustment / return_salesman / return_shop
#
# For transfers, TWO records are created:
#   source warehouse → transfer_out,  dest warehouse → transfer_in
#   Both share the same reference_id to link them.

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String(30), nullable=False, index=True)
    qty = Column(Integer, nullable=False)
    rate = Column(Float, nullable=True)
    value = Column(Float, nullable=True)
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(40), nullable=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    to_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    notes = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    warehouse = relationship("Warehouse", back_populates="stock_movements", foreign_keys=[warehouse_id])
    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id])
    product = relationship("Product", backref="stock_movements")
    salesman = relationship("Employee", backref="stock_movements", foreign_keys=[salesman_id])
    shop = relationship("Shop", backref="stock_movements", foreign_keys=[shop_id])
    supplier = relationship("Supplier", backref="stock_movements")


# ═══════════════════════════════════════════════════════════════════════════════
# [5] STOCK LEDGER  (like a bank statement — every entry with running balance)
# ═══════════════════════════════════════════════════════════════════════════════

class StockLedger(Base):
    __tablename__ = "stock_ledger"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    rate = Column(Float, nullable=True)
    value = Column(Float, nullable=True)
    balance_before = Column(Integer, nullable=False, default=0)
    balance_after = Column(Integer, nullable=False, default=0)
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(40), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    product = relationship("Product", backref="stock_ledger_entries")
    warehouse = relationship("Warehouse", backref="stock_ledger_entries")


# ═══════════════════════════════════════════════════════════════════════════════
# [6] SALESMAN ↔ WAREHOUSE LINK
# ═══════════════════════════════════════════════════════════════════════════════
# Salesman is an Employee record (from HR module) linked here.

class SalesmanWarehouse(Base):
    __tablename__ = "salesmen_warehouse"
    __table_args__ = (
        UniqueConstraint("salesman_id", "warehouse_id", name="uq_salesman_warehouse"),
    )

    id = Column(Integer, primary_key=True, index=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    areas = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active")

    salesman = relationship("Employee", backref="warehouse_assignments", foreign_keys=[salesman_id])
    warehouse = relationship("Warehouse", back_populates="salesman_assignments")


# ═══════════════════════════════════════════════════════════════════════════════
# [7] AREA
# ═══════════════════════════════════════════════════════════════════════════════

class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(255), nullable=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)

    salesman = relationship("Employee", backref="areas", foreign_keys=[salesman_id])
    shops = relationship("Shop", back_populates="area")


# ═══════════════════════════════════════════════════════════════════════════════
# [8] SHOP
# ═══════════════════════════════════════════════════════════════════════════════

class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    owner_name = Column(String(120), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(String(255), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True, index=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    credit_limit = Column(Float, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="active", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    area = relationship("Area", back_populates="shops")
    salesman = relationship("Employee", backref="shops", foreign_keys=[salesman_id])
    invoices = relationship("Invoice", back_populates="shop")
    payments = relationship("ShopPayment", back_populates="shop")
    returns = relationship("Return", back_populates="shop")


# ═══════════════════════════════════════════════════════════════════════════════
# [9] INVOICE
# ═══════════════════════════════════════════════════════════════════════════════

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(30), nullable=False, unique=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    gross_total = Column(Float, nullable=False, default=0)
    discount = Column(Float, nullable=False, default=0)
    net_total = Column(Float, nullable=False, default=0)
    paid_amount = Column(Float, nullable=False, default=0)
    balance_amount = Column(Float, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="unpaid", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    salesman = relationship("Employee", backref="invoices", foreign_keys=[salesman_id])
    shop = relationship("Shop", back_populates="invoices")
    warehouse = relationship("Warehouse", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    returns = relationship("Return", back_populates="invoice")
    payments = relationship("ShopPayment", back_populates="invoice")


# ═══════════════════════════════════════════════════════════════════════════════
# [10] INVOICE ITEM
# ═══════════════════════════════════════════════════════════════════════════════

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False)
    rate = Column(Float, nullable=False, default=0)
    amount = Column(Float, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", backref="invoice_items")


# ═══════════════════════════════════════════════════════════════════════════════
# [11] SHOP PAYMENT  (collections from shops)
# ═══════════════════════════════════════════════════════════════════════════════

class ShopPayment(Base):
    __tablename__ = "shop_payments"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_mode = Column(String(30), nullable=False, default="cash")
    reference = Column(String(80), nullable=True)
    notes = Column(Text, nullable=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    shop = relationship("Shop", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments", foreign_keys=[invoice_id])
    salesman = relationship("Employee", backref="shop_collections", foreign_keys=[salesman_id])


# ═══════════════════════════════════════════════════════════════════════════════
# [12] RETURN
# ═══════════════════════════════════════════════════════════════════════════════
# return_type: "salesman" or "shop"
#   - Salesman Return: salesman returns unsold stock to warehouse
#   - Shop Return: shop returns damaged/wrong items

class Return(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True, index=True)
    return_type = Column(String(20), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    salesman_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False)
    rate = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    warehouse = relationship("Warehouse", back_populates="returns")
    salesman = relationship("Employee", backref="returns", foreign_keys=[salesman_id])
    shop = relationship("Shop", back_populates="returns")
    invoice = relationship("Invoice", back_populates="returns")
    product = relationship("Product", backref="returns")


# ═══════════════════════════════════════════════════════════════════════════════
# [13] WAREHOUSE COA ACCOUNT
# ═══════════════════════════════════════════════════════════════════════════════

class WarehouseCOAAccount(Base):
    __tablename__ = "warehouse_coa_accounts"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "account_name", name="uq_warehouse_coa_account"),
    )

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    account_name = Column(String(120), nullable=False)
    account_type = Column(String(30), nullable=False)
    account_code = Column(String(20), nullable=True)
    is_linked_to_main_coa = Column(Integer, nullable=False, default=0)
    is_system = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    warehouse = relationship("Warehouse", back_populates="coa_accounts")
    journal_lines = relationship("WarehouseJournalLine", back_populates="account", cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════════════════
# [14] WAREHOUSE JOURNAL ENTRY
# ═══════════════════════════════════════════════════════════════════════════════

class WarehouseJournalEntry(Base):
    __tablename__ = "warehouse_journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    reference = Column(String(80), nullable=True)
    narration = Column(Text, nullable=True)
    posted_to_main = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    warehouse = relationship("Warehouse", back_populates="warehouse_journal_entries")
    lines = relationship("WarehouseJournalLine", back_populates="journal_entry", cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════════════════
# [15] WAREHOUSE JOURNAL LINE
# ═══════════════════════════════════════════════════════════════════════════════

class WarehouseJournalLine(Base):
    __tablename__ = "warehouse_journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("warehouse_journal_entries.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("warehouse_coa_accounts.id"), nullable=False, index=True)
    debit = Column(Float, nullable=False, default=0)
    credit = Column(Float, nullable=False, default=0)

    journal_entry = relationship("WarehouseJournalEntry", back_populates="lines")
    account = relationship("WarehouseCOAAccount", back_populates="journal_lines")


# ═══════════════════════════════════════════════════════════════════════════════
# [16] COA SETTING  (per-warehouse COA mode toggle)
# ═══════════════════════════════════════════════════════════════════════════════

class COASetting(Base):
    __tablename__ = "coa_settings"
    __table_args__ = (
        UniqueConstraint("warehouse_id", name="uq_coa_settings_warehouse"),
    )

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    mode = Column(String(20), nullable=False, default="separate")
    linked_main_coa_accounts = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    warehouse = relationship("Warehouse", back_populates="coa_setting")


# ═══════════════════════════════════════════════════════════════════════════════
# LEGACY — kept for backward compatibility (delegated to warehouse.py re-exports)
# ═══════════════════════════════════════════════════════════════════════════════
# The following classes from the original warehouse.py are still used by the
# existing service layer and route code. They are defined in warehouse.py which
# now re-exports everything from this file.
