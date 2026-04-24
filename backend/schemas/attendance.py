from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class CheckInRequest(BaseModel):
    employee_id: int
    date: Optional[str] = None      # "YYYY-MM-DD", defaults to today
    check_in: Optional[str] = None  # "HH:MM:SS", defaults to now


class CheckOutRequest(BaseModel):
    employee_id: int
    date: Optional[str] = None      # "YYYY-MM-DD", defaults to today
    check_out: Optional[str] = None # "HH:MM:SS", defaults to now


class AttendanceRead(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    date: Optional[date] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: str
    late_minutes: int
    created_at: Optional[datetime] = None   # nullable until DB commit flushes server_default

    class Config:
        from_attributes = True
