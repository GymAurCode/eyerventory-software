from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from backend.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    phone = Column(String(40), nullable=True)
    address = Column(String(255), nullable=True)
    email = Column(String(120), nullable=True)
    opening_balance = Column(Float, nullable=False, server_default="0")
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
