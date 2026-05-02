from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.sql import func

from backend.database import Base


class CreditAccount(Base):
    __tablename__ = "credit_accounts"
    __table_args__ = (
        CheckConstraint("party_type IN ('customer','supplier')", name="ck_credit_accounts_party_type"),
        CheckConstraint("status IN ('pending','partial','paid')", name="ck_credit_accounts_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    party_type = Column(String(16), nullable=False, index=True)
    party_id = Column(Integer, nullable=False, index=True)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, nullable=False, server_default="0")
    balance = Column(Float, nullable=False)
    status = Column(String(16), nullable=False, server_default="pending", index=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    __table_args__ = (
        CheckConstraint(
            "type IN ('sale','purchase','payment','adjustment')",
            name="ck_credit_transactions_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    credit_account_id = Column(Integer, ForeignKey("credit_accounts.id"), nullable=False, index=True)
    type = Column(String(16), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    description = Column(String(255), nullable=True)
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CreditItem(Base):
    __tablename__ = "credit_items"

    id = Column(Integer, primary_key=True, index=True)
    credit_account_id = Column(Integer, ForeignKey("credit_accounts.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    total = Column(Float, nullable=False)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("method IN ('cash','bank')", name="ck_payments_method"),
    )

    id = Column(Integer, primary_key=True, index=True)
    credit_account_id = Column(Integer, ForeignKey("credit_accounts.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    method = Column(String(16), nullable=False, server_default="cash")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (
        CheckConstraint("party_type IN ('customer','supplier')", name="ck_ledger_party_type"),
        CheckConstraint(
            "reference_type IN ('sale','purchase','payment','adjustment')",
            name="ck_ledger_reference_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    party_id = Column(Integer, nullable=False, index=True)
    party_type = Column(String(16), nullable=False, index=True)
    debit = Column(Float, nullable=False, server_default="0")
    credit = Column(Float, nullable=False, server_default="0")
    balance_after = Column(Float, nullable=False)
    reference_type = Column(String(16), nullable=False)
    reference_id = Column(Integer, nullable=True)
    date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
