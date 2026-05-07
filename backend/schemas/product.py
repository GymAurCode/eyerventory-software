from datetime import datetime
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    sku: str | None = Field(default=None, max_length=80)
    cost_price: float = Field(gt=0)
    selling_price: float = Field(ge=0, default=0.0)
    stock: int = Field(ge=0)
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


class ProductAddStock(BaseModel):
    quantity: int = Field(gt=0)
    price: float | None = Field(default=None, gt=0)


class ProductRead(BaseModel):
    id: int
    name: str
    sku: str | None
    cost_price: float
    selling_price: float
    stock: int
    category: str | None
    image_data: str | None
    image_mime: str | None
    created_at: datetime

    class Config:
        from_attributes = True


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


class BulkImportResult(BaseModel):
    total: int
    created: int
    updated: int
    failed: int
    errors: list[dict]
