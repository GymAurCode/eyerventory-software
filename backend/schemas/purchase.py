from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class PurchaseItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    purchase_price: float = Field(gt=0)


class PurchaseItemRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    purchase_price: float
    total_price: float
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseCreate(BaseModel):
    supplier_id: int = Field(gt=0)
    invoice_number: str = Field(min_length=1, max_length=80)
    purchase_date: datetime
    discount: float = Field(default=0.0, ge=0)
    tax: float = Field(default=0.0, ge=0)
    payment_type: str = Field(pattern="^(CASH|CREDIT)$")
    notes: Optional[str] = None
    items: list[PurchaseItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def check_items_not_empty(self):
        if not self.items:
            raise ValueError("At least one item is required")
        return self


class PurchaseRead(BaseModel):
    id: int
    supplier_id: int
    supplier_name: Optional[str] = None
    invoice_number: str
    purchase_date: datetime
    total_amount: float
    discount: float
    tax: float
    final_amount: float
    payment_type: str
    notes: Optional[str]
    created_at: datetime
    items: list[PurchaseItemRead] = []

    class Config:
        from_attributes = True
