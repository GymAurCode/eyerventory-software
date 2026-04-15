from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.sale import Sale
from backend.schemas.sale import SaleCreate, SaleUpdate


def create_sale(db: Session, payload: SaleCreate):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise ValueError("Product not found")
    if product.stock < payload.quantity:
        raise ValueError("Insufficient stock")

    revenue = payload.quantity * payload.selling_price
    cost = payload.quantity * product.cost_price
    profit = revenue - cost

    sale = Sale(
        product_id=payload.product_id,
        quantity=payload.quantity,
        selling_price=payload.selling_price,
        revenue=revenue,
        cost=cost,
        profit=profit,
    )
    product.stock -= payload.quantity
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


def list_sales(db: Session):
    return db.query(Sale).order_by(Sale.id.desc()).all()


def update_sale(db: Session, sale_id: int, payload: SaleUpdate):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        return None
    product = db.query(Product).filter(Product.id == sale.product_id).first()
    if not product:
        raise ValueError("Product not found")
    # Restore stock from original sale before recalculation.
    product.stock += sale.quantity
    quantity = payload.quantity if payload.quantity is not None else sale.quantity
    selling_price = payload.selling_price if payload.selling_price is not None else sale.selling_price
    if product.stock < quantity:
        raise ValueError("Insufficient stock")
    sale.quantity = quantity
    sale.selling_price = selling_price
    sale.revenue = quantity * selling_price
    sale.cost = quantity * product.cost_price
    sale.profit = sale.revenue - sale.cost
    product.stock -= quantity
    db.commit()
    db.refresh(sale)
    return sale


def delete_sale(db: Session, sale_id: int) -> bool:
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        return False
    product = db.query(Product).filter(Product.id == sale.product_id).first()
    if product:
        product.stock += sale.quantity
    db.delete(sale)
    db.commit()
    return True
