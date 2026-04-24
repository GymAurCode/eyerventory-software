from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month = Column(String(7), nullable=False)           # "YYYY-MM"
    base_salary = Column(Float, nullable=False)
    total_working_days = Column(Integer, nullable=False)
    present_days = Column(Integer, nullable=False, default=0)
    late_days = Column(Integer, nullable=False, default=0)
    absent_days = Column(Integer, nullable=False, default=0)
    deductions = Column(Float, nullable=False, default=0.0)
    bonus = Column(Float, nullable=False, default=0.0)
    net_salary = Column(Float, nullable=False)
    status = Column(String(10), nullable=False, default="unpaid")   # paid, unpaid
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="payrolls")
    payments = relationship("HRPayment", back_populates="payroll")
