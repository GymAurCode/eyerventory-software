from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    type = Column(String(20), nullable=False)  # asset, liability, equity, revenue, expense
    parent_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    journal_items = relationship("JournalItem", back_populates="account")
    children = relationship(
        "Account",
        remote_side=[id],
        backref="parent",
    )
