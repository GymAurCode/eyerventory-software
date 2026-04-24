from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    description = Column(String(255), nullable=False)
    reference_type = Column(String(50), nullable=True)  # e.g., "payroll", "expense", etc.
    reference_id = Column(Integer, nullable=True)  # e.g., payroll_id
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    journal_items = relationship("JournalItem", back_populates="journal_entry", cascade="all, delete-orphan")


class JournalItem(Base):
    __tablename__ = "journal_items"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Float, nullable=False, default=0.0)
    credit = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    journal_entry = relationship("JournalEntry", back_populates="journal_items")
    account = relationship("Account", back_populates="journal_items")
