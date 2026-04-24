from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HRPaymentCreate(BaseModel):
    employee_id: int
    payroll_id: Optional[int] = None
    amount: float
    date: str           # "YYYY-MM-DD"
    method: str         # cash, bank
    note: Optional[str] = None


class PaymentReverseRequest(BaseModel):
    payment_id: int
    reason: str
    admin_password: str


class HRPaymentRead(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    payroll_id: Optional[int] = None
    amount: float
    date: str
    method: str
    note: Optional[str] = None
    created_by: int
    is_reversed: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
