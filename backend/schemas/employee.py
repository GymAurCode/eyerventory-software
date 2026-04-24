from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EmployeeCreate(BaseModel):
    name: str
    cnic: Optional[str] = None
    phone: Optional[str] = None
    role: str = "staff"                     # admin, hr, staff
    employment_type: str                    # monthly, daily
    salary: Optional[float] = None
    daily_wage: Optional[float] = None
    job_start_time: Optional[str] = None    # "HH:MM"
    job_end_time: Optional[str] = None      # "HH:MM"
    grace_minutes: int = 10


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    cnic: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    employment_type: Optional[str] = None
    salary: Optional[float] = None
    daily_wage: Optional[float] = None
    job_start_time: Optional[str] = None
    job_end_time: Optional[str] = None
    grace_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class EmployeeRead(BaseModel):
    id: int
    name: str
    cnic: Optional[str]
    phone: Optional[str]
    role: str
    employment_type: str
    salary: Optional[float]
    daily_wage: Optional[float]
    job_start_time: Optional[str]
    job_end_time: Optional[str]
    grace_minutes: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
