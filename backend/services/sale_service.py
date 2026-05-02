from sqlalchemy.orm import Session

from backend.models.customer import Customer
from backend.models.product import Product
from backend.models.sale import Sale
from backend.schemas.sale import SaleCreate, SaleUpdate
from backend.services import accounting_service
from backend.services.credit_service import create_credit_account


def create_sale(db: Session, payload: SaleCreate):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise ValueError("Product not found")
    if product.stock < payload.quantity:
        raise ValueError("Insufficient stock")
    if payload.payment_type == "CREDIT" and not payload.customer_id:
        raise ValueError("Customer is required for credit sale")
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise ValueError("Customer not found")

    revenue = payload.quantity * payload.selling_price
    cost = payload.quantity * product.cost_price
    profit = revenue - cost

    paid_amount = float(payload.paid_amount or 0)
    if paid_amount > revenue:
        raise ValueError("Paid amount cannot exceed total amount")

    sale = Sale(
        product_id=payload.product_id,
        customer_id=payload.customer_id,
        quantity=payload.quantity,
        selling_price=payload.selling_price,
        revenue=revenue,
        cost=cost,
        profit=profit,
        payment_type=payload.payment_type,
        paid_amount=paid_amount,
        due_date=payload.due_date,
    )
    product.stock -= payload.quantity
    db.add(sale)
    db.flush()
    if payload.payment_type == "CREDIT":
        create_credit_account(
            db,
            party_type="customer",
            party_id=payload.customer_id,
            amount=revenue,
            paid_amount=paid_amount,
            reference_type="sale",
            reference_id=sale.id,
            description=f"Credit sale for product #{sale.product_id}",
            due_date=payload.due_date,
            items=[{"product_id": sale.product_id, "quantity": sale.quantity, "price": sale.selling_price}],
        )

    # Double-entry journal
    accounting_service.record_sale(
        db,
        sale_id=sale.id,
        revenue=revenue,
        cost=cost,
        paid_amount=paid_amount,
        payment_type=payload.payment_type,
        product_name=product.name,
    )

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
    payment_type = payload.payment_type if payload.payment_type is not None else sale.payment_type
    customer_id = payload.customer_id if payload.customer_id is not None else sale.customer_id
    if product.stock < quantity:
        raise ValueError("Insufficient stock")
    if payment_type == "CREDIT" and not customer_id:
        raise ValueError("Customer is required for credit sale")
    if customer_id:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise ValueError("Customer not found")
    sale.quantity = quantity
    sale.customer_id = customer_id
    sale.selling_price = selling_price
    sale.revenue = quantity * selling_price
    sale.cost = quantity * product.cost_price
    sale.profit = sale.revenue - sale.cost
    sale.payment_type = payment_type
    if payload.paid_amount is not None:
        if payload.paid_amount > sale.revenue:
            raise ValueError("Paid amount cannot exceed total amount")
        sale.paid_amount = payload.paid_amount
    sale.due_date = payload.due_date if payload.due_date is not None else sale.due_date
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
