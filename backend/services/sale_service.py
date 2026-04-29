"""
Sale Service — double-entry accounting for sales.

Cash Sale:
    Step 1 (Revenue):  Dr Cash on Hand / Cr Sales Revenue
    Step 2 (COGS):     Dr Cost of Goods Sold / Cr Inventory

Credit Sale:
    Step 1 (Revenue):  Dr Accounts Receivable / Cr Sales Revenue
    Step 2 (COGS):     Dr Cost of Goods Sold / Cr Inventory
"""
from sqlalchemy.orm import Session

from backend.models.customer import Customer
from backend.models.product import Product
from backend.models.sale import Sale
from backend.schemas.sale import SaleCreate, SaleUpdate
from backend.services.accounting_service import create_journal_entry


def create_sale(db: Session, payload: SaleCreate):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise ValueError("Product not found")
    if product.stock < payload.quantity:
        raise ValueError("Insufficient stock")

    if payload.payment_type == "credit" and not payload.customer_id:
        raise ValueError("Credit sales require a customer")

    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise ValueError("Customer not found")

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
        payment_type=payload.payment_type,
        customer_id=payload.customer_id,
    )
    product.stock -= payload.quantity
    db.add(sale)
    db.flush()  # get sale.id

    # Step 1: Revenue entry
    dr_account = "Cash on Hand" if payload.payment_type == "cash" else "Accounts Receivable"
    dr_type = "asset"
    create_journal_entry(
        db=db,
        description=f"Sale #{sale.id} — Revenue ({payload.payment_type})",
        entries=[
            {"account_name": dr_account, "account_type": dr_type, "debit": revenue, "credit": 0.0},
            {"account_name": "Sales Revenue", "account_type": "revenue", "debit": 0.0, "credit": revenue},
        ],
        reference_type="sale",
        reference_id=sale.id,
    )

    # Step 2: COGS entry
    create_journal_entry(
        db=db,
        description=f"Sale #{sale.id} — COGS",
        entries=[
            {"account_name": "Cost of Goods Sold", "account_type": "expense", "debit": cost, "credit": 0.0},
            {"account_name": "Inventory", "account_type": "asset", "debit": 0.0, "credit": cost},
        ],
        reference_type="sale_cogs",
        reference_id=sale.id,
    )

    # Update customer receivable balance for credit sales
    if payload.payment_type == "credit" and customer:
        customer.balance += revenue

    db.commit()
    db.refresh(sale)
    return sale


def list_sales(db: Session):
    return db.query(Sale).order_by(Sale.id.desc()).all()


def update_sale(db: Session, sale_id: int, payload: SaleUpdate):
    """
    Update is restricted to non-accounting fields (note/price adjustments are complex).
    For simplicity, only selling_price and quantity can be updated on cash sales.
    Credit sales cannot be edited after creation (reverse and re-create instead).
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        return None
    product = db.query(Product).filter(Product.id == sale.product_id).first()
    if not product:
        raise ValueError("Product not found")

    # Restore stock from original sale
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
