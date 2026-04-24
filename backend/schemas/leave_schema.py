from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class LeaveCreate(BaseModel):
    employee_id: int
    type: str           # sick, casual, unpaid
    start_date: str     # "YYYY-MM-DD"
    end_date: str       # "YYYY-MM-DD"
    reason: Optional[str] = None


class LeaveApprove(BaseModel):
    status: str         # approved, rejected


class LeaveRead(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    type: str
    start_date: Optional[date] = None   # date object from ORM
    end_date: Optional[date] = None
    reason: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
