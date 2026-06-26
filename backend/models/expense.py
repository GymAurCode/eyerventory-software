from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(80), nullable=True, index=True)
    voucher_no = Column(String(20), unique=True, nullable=True, index=True)
    employee_name = Column(String(120), nullable=True)
    remarks = Column(Text, nullable=True)
    expense_date = Column(Date, nullable=False)
    payment_method = Column(String(20), nullable=False, default="cash")
    reimbursement_pending = Column(Boolean, default=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items = relationship("ExpenseItem", back_populates="expense", cascade="all, delete-orphan")
    vehicle = relationship("ExpenseVehicle", back_populates="expense", uselist=False, cascade="all, delete-orphan")


class ExpenseItem(Base):
    __tablename__ = "expense_items"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    expense_type = Column(String(40), nullable=False)
    description = Column(String(255), nullable=True)
    amount = Column(Float, nullable=False)

    expense = relationship("Expense", back_populates="items")


class ExpenseVehicle(Base):
    __tablename__ = "expense_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False, unique=True)
    vehicle_name = Column(String(120), nullable=False)
    vehicle_type = Column(String(20), nullable=False)
    driver_name = Column(String(120), nullable=True)
    trip_purpose = Column(String(255), nullable=True)

    expense = relationship("Expense", back_populates="vehicle")
