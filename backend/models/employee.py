from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    cnic = Column(String(20), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, default="staff")          # admin, hr, staff
    employment_type = Column(String(10), nullable=False)                # monthly, daily
    salary = Column(Float, nullable=True)                               # monthly employees
    daily_wage = Column(Float, nullable=True)                           # daily employees
    job_start_time = Column(String(5), nullable=True)                   # "HH:MM"
    job_end_time = Column(String(5), nullable=True)                     # "HH:MM"
    grace_minutes = Column(Integer, default=10, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    attendance_logs = relationship("AttendanceLog", back_populates="employee", cascade="all, delete-orphan")
    leaves = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")
    payrolls = relationship("Payroll", back_populates="employee", cascade="all, delete-orphan")
    payments = relationship("HRPayment", back_populates="employee", cascade="all, delete-orphan")
