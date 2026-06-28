from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
# WAREHOUSE
# ═══════════════════════════════════════════════════════════════════════════════

class WarehouseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    location: Optional[str] = None
    manager_id: Optional[int] = None
    status: str = "active"
    allow_negative_stock: bool = False
    coa_mode: str = "separate"


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    manager_id: Optional[int] = None
    status: Optional[str] = None
    allow_negative_stock: Optional[bool] = None
    coa_mode: Optional[str] = None


class WarehouseRead(BaseModel):
    id: int
    name: str
    code: Optional[str]
    location: Optional[str]
    is_active: int
    manager_id: Optional[int]
    status: str
    allow_negative_stock: int
    coa_mode: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# STOCK ITEM (used across stock-in/out/transfer/adjust)
# ═══════════════════════════════════════════════════════════════════════════════

class StockItemCreate(BaseModel):
    product_id: int
    quantity: int
    rate: Optional[float] = 0
    notes: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# OPENING STOCK
# ═══════════════════════════════════════════════════════════════════════════════

class OpeningStockCreate(BaseModel):
    product_id: int
    qty: int
    rate: float = 0
    date: Optional[datetime] = None


class OpeningStockRead(BaseModel):
    id: int
    warehouse_id: int
    product_id: int
    qty: int
    rate: float
    value: float
    date: datetime
    locked: int

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# STOCK MOVEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class StockMovementRead(BaseModel):
    id: int
    warehouse_id: int
    product_id: int
    movement_type: str
    qty: int
    rate: Optional[float]
    value: Optional[float]
    reference_id: Optional[int]
    reference_type: Optional[str]
    salesman_id: Optional[int]
    shop_id: Optional[int]
    supplier_id: Optional[int]
    from_warehouse_id: Optional[int]
    to_warehouse_id: Optional[int]
    notes: Optional[str]
    date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class StockTransferCreate(BaseModel):
    source_warehouse_id: int
    dest_warehouse_id: int
    items: list[StockItemCreate]
    notes: Optional[str] = None
    date: Optional[datetime] = None


class StockInCreate(BaseModel):
    warehouse_id: int
    supplier_id: Optional[int] = None
    items: list[StockItemCreate]
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[datetime] = None


class StockOutCreate(BaseModel):
    warehouse_id: int
    salesman_id: Optional[int] = None
    shop_id: Optional[int] = None
    items: list[StockItemCreate]
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[datetime] = None


class DamageCreate(BaseModel):
    warehouse_id: int
    product_id: int
    quantity: int
    reason: Optional[str] = None
    date: Optional[datetime] = None


class AdjustmentCreate(BaseModel):
    warehouse_id: int
    items: list[StockItemCreate]
    notes: Optional[str] = None
    date: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════════
# STOCK LEDGER
# ═══════════════════════════════════════════════════════════════════════════════

class StockLedgerRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    transaction_type: str
    quantity: int
    rate: Optional[float]
    value: Optional[float]
    balance_before: int
    balance_after: int
    reference_id: Optional[int]
    reference_type: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# AREA
# ═══════════════════════════════════════════════════════════════════════════════

class AreaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    salesman_id: Optional[int] = None


class AreaRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    salesman_id: Optional[int]

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# SALESMAN WAREHOUSE LINK
# ═══════════════════════════════════════════════════════════════════════════════

class SalesmanWarehouseCreate(BaseModel):
    salesman_id: int
    warehouse_id: int
    areas: Optional[str] = None


class SalesmanWarehouseRead(BaseModel):
    id: int
    salesman_id: int
    warehouse_id: int
    areas: Optional[str]
    status: str

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# SHOP
# ═══════════════════════════════════════════════════════════════════════════════

class ShopCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    area_id: Optional[int] = None
    salesman_id: Optional[int] = None
    credit_limit: float = 0


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    area_id: Optional[int] = None
    salesman_id: Optional[int] = None
    credit_limit: Optional[float] = None
    status: Optional[str] = None


class ShopRead(BaseModel):
    id: int
    name: str
    owner_name: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    area_id: Optional[int]
    salesman_id: Optional[int]
    credit_limit: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShopDetail(ShopRead):
    area_name: Optional[str] = None
    salesman_name: Optional[str] = None
    total_purchases: float = 0
    total_paid: float = 0
    outstanding: float = 0


# ═══════════════════════════════════════════════════════════════════════════════
# INVOICE
# ═══════════════════════════════════════════════════════════════════════════════

class InvoiceItemCreate(BaseModel):
    product_id: int
    qty: int
    rate: float = 0


class InvoiceCreate(BaseModel):
    date: Optional[datetime] = None
    salesman_id: int
    shop_id: int
    warehouse_id: int
    items: list[InvoiceItemCreate]
    discount: float = 0
    paid_amount: float = 0


class InvoiceItemRead(BaseModel):
    id: int
    invoice_id: int
    product_id: int
    qty: int
    rate: float
    amount: float

    class Config:
        from_attributes = True


class InvoiceRead(BaseModel):
    id: int
    invoice_no: str
    date: datetime
    salesman_id: int
    shop_id: int
    warehouse_id: int
    gross_total: float
    discount: float
    net_total: float
    paid_amount: float
    balance_amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceDetail(InvoiceRead):
    items: list[InvoiceItemRead] = []
    shop_name: Optional[str] = None
    salesman_name: Optional[str] = None
    warehouse_name: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENT
# ═══════════════════════════════════════════════════════════════════════════════

class PaymentCreate(BaseModel):
    shop_id: int
    invoice_id: Optional[int] = None
    date: Optional[datetime] = None
    amount: float
    payment_mode: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None
    salesman_id: Optional[int] = None


class PaymentRead(BaseModel):
    id: int
    shop_id: int
    invoice_id: Optional[int]
    date: datetime
    amount: float
    payment_mode: str
    reference: Optional[str]
    notes: Optional[str]
    salesman_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# RETURN
# ═══════════════════════════════════════════════════════════════════════════════

class ReturnCreate(BaseModel):
    return_type: str = Field(pattern="^(salesman|shop)$")
    warehouse_id: int
    salesman_id: Optional[int] = None
    shop_id: Optional[int] = None
    invoice_id: Optional[int] = None
    product_id: int
    qty: int
    rate: Optional[float] = None
    reason: Optional[str] = None
    date: Optional[datetime] = None


class ReturnRead(BaseModel):
    id: int
    return_type: str
    warehouse_id: int
    salesman_id: Optional[int]
    shop_id: Optional[int]
    invoice_id: Optional[int]
    product_id: int
    qty: int
    rate: Optional[float]
    reason: Optional[str]
    date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# COA SETTINGS & ACCOUNTS
# ═══════════════════════════════════════════════════════════════════════════════

class COASettingUpdate(BaseModel):
    mode: str = Field(pattern="^(separate|merged)$")
    linked_main_coa_accounts: Optional[str] = None


class COASettingRead(BaseModel):
    id: int
    warehouse_id: int
    mode: str
    linked_main_coa_accounts: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


class WarehouseCOAAccountRead(BaseModel):
    id: int
    warehouse_id: int
    account_name: str
    account_type: str
    account_code: Optional[str]
    is_linked_to_main_coa: int
    is_system: int = 0
    description: Optional[str] = None

    class Config:
        from_attributes = True


class WarehouseCOAAccountCreate(BaseModel):
    account_name: str = Field(min_length=1, max_length=120)
    account_type: str = Field(pattern="^(Asset|Liability|Income|Expense|Equity)$")
    account_code: str = Field(min_length=1, max_length=20)
    description: Optional[str] = None


class WarehouseJournalEntryRead(BaseModel):
    id: int
    warehouse_id: int
    date: datetime
    reference: Optional[str]
    narration: Optional[str]
    posted_to_main: int
    created_at: datetime

    class Config:
        from_attributes = True


class WarehouseJournalLineRead(BaseModel):
    id: int
    journal_id: int
    account_id: int
    debit: float
    credit: float

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD / REPORTS
# ═══════════════════════════════════════════════════════════════════════════════

class DashboardStats(BaseModel):
    total_warehouses: int = 0
    total_products: int = 0
    total_stock_value: float = 0
    today_deliveries: int = 0
    today_collections: float = 0
    outstanding_collections: float = 0
    low_stock_alerts: int = 0
    total_shops: int = 0
    total_salesmen: int = 0
