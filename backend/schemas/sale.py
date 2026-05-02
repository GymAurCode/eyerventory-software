from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class SaleCreate(BaseModel):
    product_id: int = Field(gt=0)
    customer_id: int | None = Field(default=None, gt=0)
    quantity: int = Field(gt=0)
    selling_price: float = Field(gt=0)
<<<<<<< HEAD
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
=======
    payment_type: str = "cash"          # cash | credit
    customer_id: Optional[int] = None

    @field_validator("payment_type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("cash", "credit"):
            raise ValueError("payment_type must be 'cash' or 'credit'")
        return v


class SaleUpdate(BaseModel):
    quantity: Optional[int] = Field(default=None, gt=0)
    selling_price: Optional[float] = Field(default=None, gt=0)
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a


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
<<<<<<< HEAD
    paid_amount: float
    due_amount: float
    due_date: datetime | None
=======
    customer_id: Optional[int]
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    created_at: datetime

    model_config = {"from_attributes": True}


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
<<<<<<< HEAD
=======

    model_config = {"from_attributes": True}
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
