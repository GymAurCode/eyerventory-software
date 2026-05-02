from datetime import datetime
from typing import Optional

<<<<<<< HEAD
from pydantic import BaseModel, Field, model_validator


class PurchaseItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    purchase_price: float = Field(gt=0)
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a


class PurchaseItemRead(BaseModel):
    id: int
    product_id: int
    quantity: int
<<<<<<< HEAD
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
=======
    unit_cost: float
    total_cost: float

    model_config = {"from_attributes": True}
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a


class PurchaseRead(BaseModel):
    id: int
<<<<<<< HEAD
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
=======
    supplier_id: Optional[int]
    payment_type: str
    total_amount: float
    note: Optional[str]
    created_at: datetime
    items: list[PurchaseItemRead] = []

    model_config = {"from_attributes": True}
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
