from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v):
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v

    @field_validator("unit_cost")
    @classmethod
    def cost_positive(cls, v):
        if v <= 0:
            raise ValueError("unit_cost must be positive")
        return v


class PurchaseCreate(BaseModel):
    supplier_id: Optional[int] = None
    payment_type: str = "cash"   # cash | credit
    items: list[PurchaseItemCreate]
    note: Optional[str] = None

    @field_validator("payment_type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("cash", "credit"):
            raise ValueError("payment_type must be 'cash' or 'credit'")
        return v


class PurchaseItemRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_cost: float
    total_cost: float

    model_config = {"from_attributes": True}


class PurchaseRead(BaseModel):
    id: int
    supplier_id: Optional[int]
    payment_type: str
    total_amount: float
    note: Optional[str]
    created_at: datetime
    items: list[PurchaseItemRead] = []

    model_config = {"from_attributes": True}
