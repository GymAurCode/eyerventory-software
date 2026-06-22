from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from backend.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    action_type = Column(String(50), nullable=False)
    description = Column(String, nullable=False)
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(50), nullable=True)
    amount = Column(Float, nullable=True)
    created_by = Column(String(100), nullable=False, default="system")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
