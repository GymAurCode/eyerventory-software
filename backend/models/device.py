from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from backend.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    device_type = Column(String(60), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="unknown")
    model = Column(String(120), nullable=True)
    serial_number = Column(String(120), nullable=True, unique=True)
    firmware_version = Column(String(60), nullable=True)
    connection_type = Column(String(30), nullable=True)
    connection_method = Column(String(20), nullable=True)
    signal_strength = Column(Integer, nullable=True)
    driver_status = Column(String(30), nullable=True)
    last_connected_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    assigned_pos_terminal = Column(String(120), nullable=True)
    location_branch = Column(String(120), nullable=True)
    error_message = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
