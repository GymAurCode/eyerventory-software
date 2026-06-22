from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from backend.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    sku = Column(String(80), nullable=True, unique=True, index=True)
    cost_price = Column(Float, nullable=False)
    selling_price = Column(Float, nullable=False, default=0.0)
    stock = Column(Integer, nullable=False, default=0)
    category = Column(String(80), nullable=True)
    image_data = Column(String, nullable=True)
    image_mime = Column(String(32), nullable=True)
    barcode_number = Column(String(20), nullable=True, unique=True)
    barcode_image_path = Column(String(255), nullable=True)
    low_stock_threshold = Column(Integer, nullable=False, default=10)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
