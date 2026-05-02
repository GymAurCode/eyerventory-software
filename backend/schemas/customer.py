from datetime import datetime

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=120)
    opening_balance: float = Field(default=0.0, ge=0)
    notes: str | None = Field(default=None, max_length=500)


class CustomerRead(CustomerCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=120)
    opening_balance: float = Field(default=0.0, ge=0)
    notes: str | None = Field(default=None, max_length=500)
