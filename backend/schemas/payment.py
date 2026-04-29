from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class PaymentCreate(BaseModel):
    direction: str          # 'receive' | 'pay'
    customer_id: Optional[int] = None
    supplier_id: Optional[int] = None
    amount: float
    note: Optional[str] = None

    @field_validator("direction")
    @classmethod
    def valid_direction(cls, v):
        if v not in ("receive", "pay"):
            raise ValueError("direction must be 'receive' or 'pay'")
        return v

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class PaymentRead(BaseModel):
    id: int
    direction: str
    customer_id: Optional[int]
    supplier_id: Optional[int]
    amount: float
    note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
