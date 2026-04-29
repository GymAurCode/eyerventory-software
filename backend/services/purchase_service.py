"""
Purchase Service — double-entry accounting for inventory purchases.

Cash Purchase:
    Dr Inventory (asset)
    Cr Cash on Hand (asset)

Credit Purchase:
    Dr Inventory (asset)
    Cr Accounts Payable (liability)
"""
from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.purchase import Purchase, PurchaseItem
from backend.models.supplier import Supplier
from backend.schemas.purchase import PurchaseCreate
from backend.services.accounting_service import create_journal_entry


def create_purchase(db: Session, payload: PurchaseCreate) -> Purchase:
    # Validate supplier if provided
    supplier = None
    if payload.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise ValueError("Supplier not found")

    if payload.payment_type == "credit" and not payload.supplier_id:
        raise ValueError("Credit purchases require a supplier")

    # Validate all products and compute total
    total = 0.0
    resolved_items = []
    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise ValueError(f"Product {item.product_id} not found")
        line_total = item.quantity * item.unit_cost
        total += line_total
        resolved_items.append((product, item.quantity, item.unit_cost, line_total))

    # Create purchase record
    purchase = Purchase(
        supplier_id=payload.supplier_id,
        payment_type=payload.payment_type,
        total_amount=total,
        note=payload.note,
    )
    db.add(purchase)
    db.flush()  # get purchase.id

    # Create line items and update stock + cost_price
    for product, qty, unit_cost, line_total in resolved_items:
        db.add(PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            quantity=qty,
            unit_cost=unit_cost,
            total_cost=line_total,
        ))
        product.stock += qty
        # Update weighted average cost price
        old_value = product.cost_price * (product.stock - qty)
        product.cost_price = (old_value + line_total) / product.stock

    # Double-entry journal
    cr_account = "Cash on Hand" if payload.payment_type == "cash" else "Accounts Payable"
    cr_type = "asset" if payload.payment_type == "cash" else "liability"

    create_journal_entry(
        db=db,
        description=f"Purchase #{purchase.id} — {payload.payment_type}",
        entries=[
            {"account_name": "Inventory", "account_type": "asset", "debit": total, "credit": 0.0},
            {"account_name": cr_account, "account_type": cr_type, "debit": 0.0, "credit": total},
        ],
        reference_type="purchase",
        reference_id=purchase.id,
    )

    # Update supplier payable balance for credit purchases
    if payload.payment_type == "credit" and supplier:
        supplier.balance += total

    db.commit()
    db.refresh(purchase)
    return purchase


def list_purchases(db: Session):
    return db.query(Purchase).order_by(Purchase.id.desc()).all()


def get_purchase(db: Session, purchase_id: int):
    return db.query(Purchase).filter(Purchase.id == purchase_id).first()
