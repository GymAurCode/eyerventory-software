from datetime import datetime
<<<<<<< HEAD
=======
from typing import Optional

>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
<<<<<<< HEAD
    sku: str | None = Field(default=None, max_length=80)
=======
    sku: Optional[str] = Field(default=None, max_length=60)
    category: Optional[str] = Field(default=None, max_length=60)
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    cost_price: float = Field(gt=0)
    selling_price: float = Field(ge=0, default=0.0)
    stock: int = Field(ge=0)
<<<<<<< HEAD
    category: str | None = Field(default=None, max_length=80)
    image_data: str | None = None
    image_mime: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    sku: str | None = Field(default=None, max_length=80)
    cost_price: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    category: str | None = Field(default=None, max_length=80)
    image_data: str | None = None
    image_mime: str | None = None
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a


class ProductAddStock(BaseModel):
    quantity: int = Field(gt=0)
    price: Optional[float] = Field(default=None, gt=0)


class ProductRead(BaseModel):
    id: int
    name: str
<<<<<<< HEAD
    sku: str | None
=======
    sku: Optional[str]
    category: Optional[str]
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    cost_price: float
    selling_price: float
    stock: int
<<<<<<< HEAD
    category: str | None
    image_data: str | None
    image_mime: str | None
=======
    image_data: Optional[str]
    image_mime: Optional[str]
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    created_at: datetime

    class Config:
        from_attributes = True


<<<<<<< HEAD
class ImportRowResult(BaseModel):
    row: int
    sku: str
    name: str
    action: str          # "inserted" | "updated" | "failed"
    error: str | None = None


class ImportSummary(BaseModel):
    total: int
    inserted: int
    updated: int
    failed: int
    rows: list[ImportRowResult]
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
