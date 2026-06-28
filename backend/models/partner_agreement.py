from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base


class PartnerAgreement(Base):
    __tablename__ = "partner_agreements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    agreement_start_date = Column(DateTime, nullable=False)
    agreement_end_date = Column(DateTime, nullable=True)
    duration_value = Column(Integer, nullable=True)
    duration_unit = Column(String(10), nullable=True)
    has_investment = Column(Boolean, nullable=False, default=False)
    investment_amount = Column(Float, nullable=True)
    profit_share_percent = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")
