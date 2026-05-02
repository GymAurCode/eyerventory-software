from datetime import datetime

from pydantic import BaseModel, Field


class SaleCreate(BaseModel):
    product_id: int = Field(gt=0)
    customer_id: int | None = Field(default=None, gt=0)
    quantity: int = Field(gt=0)
    selling_price: float = Field(gt=0)
    payment_type: str = Field(default="CASH", pattern="^(CASH|CREDIT)$")
    paid_amount: float | None = Field(default=None, ge=0)
    due_date: datetime | None = None


class SaleUpdate(BaseModel):
    customer_id: int | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, gt=0)
    selling_price: float | None = Field(default=None, gt=0)
    payment_type: str | None = Field(default=None, pattern="^(CASH|CREDIT)$")
    paid_amount: float | None = Field(default=None, ge=0)
    due_date: datetime | None = None


class SaleRead(BaseModel):
    id: int
    product_id: int
    customer_id: int | None
    quantity: int
    selling_price: float
    revenue: float
    cost: float
    profit: float
    payment_type: str
    paid_amount: float
    due_amount: float
    due_date: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class SaleStaffRead(BaseModel):
    id: int
    product_id: int
    customer_id: int | None
    quantity: int
    selling_price: float
    payment_type: str
    paid_amount: float
    due_amount: float
    due_date: datetime | None
    created_at: datetime
