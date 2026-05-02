from sqlalchemy import Column, DateTime, Float, Integer, String
<<<<<<< HEAD
=======
from sqlalchemy.orm import relationship
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
from sqlalchemy.sql import func

from backend.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
<<<<<<< HEAD
    name = Column(String(120), nullable=False, index=True)
    phone = Column(String(40), nullable=True)
    address = Column(String(255), nullable=True)
    email = Column(String(120), nullable=True)
    opening_balance = Column(Float, nullable=False, server_default="0")
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
=======
    name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(120), nullable=True)
    address = Column(String(255), nullable=True)
    # Running payable balance (positive = we owe them)
    balance = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    purchases = relationship("Purchase", back_populates="supplier")
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
