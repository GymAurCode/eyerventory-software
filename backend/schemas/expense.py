from datetime import date, datetime

from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    amount: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)
    expense_date: date


class ExpenseRead(BaseModel):
    id: int
    category: str
    amount: float
    note: str | None
    expense_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=2, max_length=80)
    amount: float | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=255)
    expense_date: date | None = None
