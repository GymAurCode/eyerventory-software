from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    sku: Optional[str] = Field(default=None, max_length=60)
    category: Optional[str] = Field(default=None, max_length=60)
    cost_price: float = Field(gt=0)
    selling_price: float = Field(ge=0, default=0.0)
    stock: int = Field(ge=0)
    image_data: Optional[str] = None
    image_mime: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    sku: Optional[str] = Field(default=None, max_length=60)
    category: Optional[str] = Field(default=None, max_length=60)
    cost_price: Optional[float] = Field(default=None, gt=0)
    selling_price: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    image_data: Optional[str] = None
    image_mime: Optional[str] = None


class ProductAddStock(BaseModel):
    quantity: int = Field(gt=0)
    price: Optional[float] = Field(default=None, gt=0)


class ProductRead(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    category: Optional[str]
    cost_price: float
    selling_price: float
    stock: int
    image_data: Optional[str]
    image_mime: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Bulk import ───────────────────────────────────────────────────────────────

class BulkImportRow(BaseModel):
    """One validated row from the Excel upload."""
    product_name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    purchase_price: float
    sale_price: float
    stock_quantity: int


class BulkImportResult(BaseModel):
    total: int
    created: int
    updated: int
    failed: int
    errors: list[dict]  # [{row: int, sku: str, reason: str}]
