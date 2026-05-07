from datetime import datetime

from pydantic import BaseModel, Field


class CreditItemPayload(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    price: float = Field(gt=0)


class CreditCreate(BaseModel):
    party_type: str = Field(pattern="^(customer|supplier)$")
    party_id: int = Field(gt=0)
    type: str = Field(pattern="^(sale|purchase)$")
    amount: float = Field(gt=0)
    paid_amount: float = Field(default=0, ge=0)
    description: str | None = Field(default=None, max_length=255)
    reference_id: int | None = None
    due_date: datetime | None = None
    items: list[CreditItemPayload] = Field(default_factory=list)


class CreditPaymentCreate(BaseModel):
    credit_account_id: int = Field(gt=0)
    amount: float = Field(gt=0)
    method: str = Field(pattern="^(cash|bank)$")
    description: str | None = Field(default=None, max_length=255)


class CreditListRead(BaseModel):
    id: int
    party_type: str
    party_id: int
    total_amount: float
    paid_amount: float
    balance: float
    status: str
    due_date: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class CreditItemRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    price: float
    total: float


class CreditTransactionRead(BaseModel):
    id: int
    type: str
    amount: float
    description: str | None
    reference_id: int | None
    created_at: datetime


class PaymentRead(BaseModel):
    id: int
    amount: float
    method: str
    created_at: datetime


class CreditDetailRead(CreditListRead):
    party_name: str
    transactions: list[CreditTransactionRead] = Field(default_factory=list)
    items: list[CreditItemRead] = Field(default_factory=list)
    payments: list[PaymentRead] = Field(default_factory=list)


class LedgerEntryRead(BaseModel):
    id: int
    party_id: int
    party_type: str
    debit: float
    credit: float
    balance_after: float
    reference_type: str
    reference_id: int | None
    date: datetime

    class Config:
        from_attributes = True


class CreditSummaryRead(BaseModel):
    total_receivable: float
    total_payable: float
    overdue_amount: float
    recent_credits: int
    receivable_by_customer: list[dict]
    payable_by_supplier: list[dict]
    cash_sales_total: float
    credit_sales_total: float
