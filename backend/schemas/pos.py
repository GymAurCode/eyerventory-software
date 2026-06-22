from datetime import datetime

from pydantic import BaseModel, Field


class PosSaleItemCreate(BaseModel):
    item_id: int = Field(gt=0)
    item_name: str = Field(min_length=1)
    qty: int = Field(gt=0)
    unit_price: float = Field(ge=0)
    total_price: float = Field(ge=0)


class PosSaleCreate(BaseModel):
    items: list[PosSaleItemCreate] = Field(min_length=1)
    subtotal: float = Field(ge=0)
    discount: float = Field(default=0, ge=0)
    total: float = Field(ge=0)
    payment_method: str = Field(default="cash", pattern="^(cash|card|other)$")
    cash_received: float | None = Field(default=None, ge=0)
    change_amount: float | None = Field(default=None, ge=0)
    customer_id: int | None = Field(default=None, gt=0)


class PosSaleItemRead(BaseModel):
    id: int
    sale_id: int
    item_id: int
    item_name: str
    qty: int
    unit_price: float
    total_price: float

    model_config = {"from_attributes": True}


class PosSaleRead(BaseModel):
    id: int
    bill_number: str
    customer_id: int | None
    subtotal: float
    discount: float
    total: float
    payment_method: str
    cash_received: float | None
    change_amount: float | None
    status: str = "completed"
    created_at: datetime
    items: list[PosSaleItemRead]

    model_config = {"from_attributes": True}


class SaleItemDetail(BaseModel):
    item_id: int
    name: str
    qty: int
    unit_price: float
    total: float


class SaleResponse(BaseModel):
    sale_id: int
    bill_number: str
    success: bool = True


class SaleReturnItemCreate(BaseModel):
    item_id: int = Field(gt=0)
    qty: int = Field(gt=0)


class SaleReturnCreate(BaseModel):
    items: list[SaleReturnItemCreate] = Field(min_length=1)
    reason: str | None = Field(default=None)


class SaleReturnItemRead(BaseModel):
    id: int
    return_id: int
    item_id: int
    item_name: str
    qty: int
    unit_price: float
    total_price: float

    model_config = {"from_attributes": True}


class SaleReturnRead(BaseModel):
    id: int
    sale_id: int
    reason: str | None
    total_refund: float
    created_at: datetime
    items: list[SaleReturnItemRead]

    model_config = {"from_attributes": True}
