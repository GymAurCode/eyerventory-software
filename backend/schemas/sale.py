from datetime import datetime

from pydantic import BaseModel, Field


class SaleCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    selling_price: float = Field(gt=0)


class SaleUpdate(BaseModel):
    product_id: int | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, gt=0)
    selling_price: float | None = Field(default=None, gt=0)


class SaleRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    selling_price: float
    revenue: float
    cost: float
    profit: float
    created_at: datetime

    class Config:
        from_attributes = True


class SaleStaffRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    selling_price: float
    created_at: datetime


class SaleUpdate(BaseModel):
    quantity: int | None = Field(default=None, gt=0)
    selling_price: float | None = Field(default=None, gt=0)
