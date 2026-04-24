from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PayrollGenerate(BaseModel):
    employee_id: int
    month: str              # "YYYY-MM"
    total_working_days: int
    bonus: float = 0.0


class PayrollRead(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    month: str
    base_salary: float
    total_working_days: int
    present_days: int
    late_days: int
    absent_days: int
    deductions: float
    bonus: float
    net_salary: float
    status: str
    paid_amount: Optional[float] = 0.0
    remaining: Optional[float] = 0.0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PayrollMarkPaid(BaseModel):
    payroll_id: int
