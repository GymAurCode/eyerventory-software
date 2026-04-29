from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class SaleCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    selling_price: float = Field(gt=0)
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


class SaleRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    selling_price: float
    revenue: float
    cost: float
    profit: float
    payment_type: str
    customer_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class SaleStaffRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    selling_price: float
    created_at: datetime

    model_config = {"from_attributes": True}
