from datetime import date as date_type

from pydantic import BaseModel, Field


class ProductAddPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    model: str | None = Field(default=None, max_length=120)
    company: str = Field(min_length=1, max_length=120)

    stock_quantity: int = Field(default=0, ge=0)

    is_curtain: bool = False
    number_of_curtains: int | None = Field(default=None, ge=1)
    pieces_per_curtain: int | None = Field(default=None, ge=1)
    per_piece_price: float | None = Field(default=None, ge=0)

    cost_price: float = Field(gt=0)
    selling_price: float = Field(ge=0, default=0.0)

    transaction_type: str = Field(pattern="^(CREDIT|DEBIT)$")
    total_amount: float | None = Field(default=None, ge=0)
    amount_paid: float | None = Field(default=None, ge=0)

    reference_no: str | None = Field(default=None, max_length=60)
    date: date_type | None = Field(default=None)
