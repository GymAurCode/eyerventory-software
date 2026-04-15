from datetime import datetime

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    cost_price: float = Field(gt=0)
    stock: int = Field(ge=0)
    image_data: str | None = None
    image_mime: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    cost_price: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    image_data: str | None = None
    image_mime: str | None = None


class ProductAddStock(BaseModel):
    quantity: int = Field(gt=0)
    price: float | None = Field(default=None, gt=0)


class ProductRead(BaseModel):
    id: int
    name: str
    cost_price: float
    stock: int
    image_data: str | None
    image_mime: str | None
    created_at: datetime

    class Config:
        from_attributes = True
