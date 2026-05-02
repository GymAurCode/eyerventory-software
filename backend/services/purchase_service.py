"""
<<<<<<< HEAD
Purchase Service
================
Handles purchase creation with full double-entry accounting integration.

Accounting rules:
  CASH purchase:
    DR Inventory (Asset)       final_amount
    CR Cash on Hand (Asset)    final_amount

  CREDIT purchase:
    DR Inventory (Asset)       final_amount
    CR Accounts Payable (Liability)  final_amount
"""
import logging
from datetime import datetime

=======
Purchase Service — double-entry accounting for inventory purchases.

Cash Purchase:
    Dr Inventory (asset)
    Cr Cash on Hand (asset)

Credit Purchase:
    Dr Inventory (asset)
    Cr Accounts Payable (liability)
"""
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.purchase import Purchase, PurchaseItem
from backend.models.supplier import Supplier
from backend.schemas.purchase import PurchaseCreate
from backend.services.accounting_service import create_journal_entry

<<<<<<< HEAD
logger = logging.getLogger(__name__)


def _calc_totals(items_data, discount: float, tax: float):
    subtotal = sum(i.quantity * i.purchase_price for i in items_data)
    final = subtotal - discount + tax
    return round(subtotal, 2), round(final, 2)


def create_purchase(db: Session, payload: PurchaseCreate) -> Purchase:
    """Create a new purchase with items, update inventory, and create accounting entries."""
    try:
        # --- Validate supplier ---
        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            logger.error(f"Supplier {payload.supplier_id} not found")
            raise ValueError(f"Supplier {payload.supplier_id} not found")

        # --- Validate duplicate invoice ---
        existing = db.query(Purchase).filter(Purchase.invoice_number == payload.invoice_number).first()
        if existing:
            logger.error(f"Invoice number '{payload.invoice_number}' already exists")
            raise ValueError(f"Invoice number '{payload.invoice_number}' already exists")

        # --- Validate products and compute totals ---
        total_amount, final_amount = _calc_totals(payload.items, payload.discount, payload.tax)

        # --- Create Purchase record ---
        purchase = Purchase(
            supplier_id=payload.supplier_id,
            invoice_number=payload.invoice_number,
            purchase_date=payload.purchase_date,
            total_amount=total_amount,
            discount=payload.discount,
            tax=payload.tax,
            final_amount=final_amount,
            payment_type=payload.payment_type,
            notes=payload.notes,
        )
        db.add(purchase)
        db.flush()  # get purchase.id
        logger.info(f"Created purchase #{purchase.id} for supplier {supplier.name}")

        # --- Create line items + update stock ---
        for item_data in payload.items:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                logger.error(f"Product {item_data.product_id} not found")
                raise ValueError(f"Product {item_data.product_id} not found")
            if item_data.quantity <= 0:
                raise ValueError(f"Quantity must be > 0 for product {item_data.product_id}")
            if item_data.purchase_price <= 0:
                raise ValueError(f"Price must be > 0 for product {item_data.product_id}")

            line_total = round(item_data.quantity * item_data.purchase_price, 2)
            db.add(PurchaseItem(
                purchase_id=purchase.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                purchase_price=item_data.purchase_price,
                total_price=line_total,
            ))

            # Weighted average cost price update
            old_stock = product.stock or 0
            old_cost = product.cost_price or 0.0
            new_stock = old_stock + item_data.quantity
            if new_stock > 0:
                product.cost_price = round(
                    (old_cost * old_stock + item_data.purchase_price * item_data.quantity) / new_stock, 4
                )
            product.stock = new_stock
            logger.info(f"Updated product {product.name}: stock {old_stock} -> {new_stock}")

        db.flush()

        # --- Double-entry journal ---
        try:
            if payload.payment_type == "CASH":
                entries = [
                    {"account_name": "Inventory",     "account_type": "asset", "debit": final_amount, "credit": 0.0},
                    {"account_name": "Cash on Hand",  "account_type": "asset", "debit": 0.0, "credit": final_amount},
                ]
            else:  # CREDIT
                entries = [
                    {"account_name": "Inventory",         "account_type": "asset",     "debit": final_amount, "credit": 0.0},
                    {"account_name": "Accounts Payable",  "account_type": "liability", "debit": 0.0, "credit": final_amount},
                ]

            create_journal_entry(
                db,
                description=f"Purchase #{payload.invoice_number} — {supplier.name}",
                entries=entries,
                reference_type="purchase",
                reference_id=purchase.id,
            )
            logger.info(f"Created journal entry for purchase #{purchase.id}")
        except Exception as journal_err:
            logger.error(f"Failed to create journal entry for purchase #{purchase.id}: {journal_err}")
            # Don't fail the entire purchase if journal fails, but log it
            # In production, you might want to handle this differently

        db.commit()
        db.refresh(purchase)
        
        # Eager load relationships for the response
        from sqlalchemy.orm import joinedload
        purchase = (
            db.query(Purchase)
            .options(
                joinedload(Purchase.supplier),
                joinedload(Purchase.items).joinedload(PurchaseItem.product)
            )
            .filter(Purchase.id == purchase.id)
            .first()
        )
        
        return purchase
    except ValueError:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating purchase: {e}", exc_info=True)
        raise


def list_purchases(db: Session) -> list[Purchase]:
    """Fetch all purchases with eager loading of relationships."""
    from sqlalchemy.orm import joinedload
    
    try:
        purchases = (
            db.query(Purchase)
            .options(
                joinedload(Purchase.supplier),
                joinedload(Purchase.items).joinedload(PurchaseItem.product)
            )
            .order_by(Purchase.created_at.desc())
            .all()
        )
        logger.info(f"Fetched {len(purchases)} purchases")
        return purchases
    except Exception as e:
        logger.error(f"Error fetching purchases: {e}", exc_info=True)
        raise


def get_purchase(db: Session, purchase_id: int) -> Purchase | None:
    """Fetch a single purchase with eager loading of relationships."""
    from sqlalchemy.orm import joinedload
    
    try:
        purchase = (
            db.query(Purchase)
            .options(
                joinedload(Purchase.supplier),
                joinedload(Purchase.items).joinedload(PurchaseItem.product)
            )
            .filter(Purchase.id == purchase_id)
            .first()
        )
        if purchase:
            logger.info(f"Fetched purchase #{purchase_id}")
        else:
            logger.warning(f"Purchase #{purchase_id} not found")
        return purchase
    except Exception as e:
        logger.error(f"Error fetching purchase #{purchase_id}: {e}", exc_info=True)
        raise


def delete_purchase(db: Session, purchase_id: int) -> bool:
    """Delete a purchase and its items (cascade)."""
    try:
        purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
        if not purchase:
            logger.warning(f"Purchase #{purchase_id} not found for deletion")
            return False
        
        logger.info(f"Deleting purchase #{purchase_id}")
        db.delete(purchase)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting purchase #{purchase_id}: {e}", exc_info=True)
        raise
=======

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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
