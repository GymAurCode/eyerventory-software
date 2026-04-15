from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship

from backend.database import Base


class OwnerShare(Base):
    __tablename__ = "owner_shares"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    ownership_percentage = Column(Float, nullable=False)

    user = relationship("User")
