from sqlalchemy import Column, Date, Float, ForeignKey, Integer

from backend.database import Base


class SupplierProductPrice(Base):
    __tablename__ = "supplier_product_prices"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    price = Column(Float, nullable=False)
    date = Column(Date, nullable=False, index=True)

