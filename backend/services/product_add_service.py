import logging
import time
from datetime import date, datetime

from sqlalchemy.orm import Session

from backend.models.account import Account
from backend.models.credit import CreditAccount, CreditItem, CreditPayment, CreditTransaction
from backend.models.journal import JournalEntry, JournalItem
from backend.models.product import Product
from backend.models.purchase import Purchase, PurchaseItem
from backend.models.supplier import Supplier
from backend.schemas.product_add import ProductAddPayload
from backend.services.accounting_service import create_journal_entry
from backend.utils.activity import log_activity

logger = logging.getLogger(__name__)


def _find_or_create_supplier(db: Session, company_name: str) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.name == company_name.strip()).first()
    if not supplier:
        supplier = Supplier(name=company_name.strip())
        db.add(supplier)
        db.flush()
        logger.info(f"Created new supplier: {supplier.name}")
    return supplier


def _append_ledger_entry(
    db: Session,
    party_type: str,
    party_id: int,
    debit: float,
    credit: float,
    reference_type: str,
    reference_id: int | None,
):
    from backend.models.credit import LedgerEntry
    prev = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.party_type == party_type, LedgerEntry.party_id == party_id)
        .order_by(LedgerEntry.id.desc())
        .first()
    )
    prev_balance = float(prev.balance_after if prev else 0)
    balance_after = prev_balance + float(debit) - float(credit)
    entry = LedgerEntry(
        party_type=party_type,
        party_id=party_id,
        debit=debit,
        credit=credit,
        balance_after=balance_after,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(entry)
    return entry


def _generate_barcode(product_id: int):
    from backend.utils.barcode import generate_barcode
    try:
        code, image_path = generate_barcode(product_id)
        return code, image_path
    except Exception as e:
        logger.warning(f"Barcode generation failed for product {product_id}: {e}")
        return None, None


def add_product_with_purchase(db: Session, payload: ProductAddPayload) -> dict:
    company = payload.company.strip()
    supplier = _find_or_create_supplier(db, company)

    if payload.is_curtain:
        total_pieces = payload.number_of_curtains * payload.pieces_per_curtain
        stock = total_pieces
        product_cost_price = payload.per_piece_price
        purchase_subtotal = round(total_pieces * payload.per_piece_price, 2)
    else:
        stock = payload.stock_quantity
        product_cost_price = payload.cost_price
        purchase_subtotal = round(stock * payload.cost_price, 2)

    total_amount = payload.total_amount if payload.total_amount is not None else purchase_subtotal
    total_amount = round(float(total_amount), 2)
    amount_paid = round(float(payload.amount_paid or 0), 2)

    if amount_paid > total_amount:
        raise ValueError("Amount paid cannot exceed total amount")

    remaining = round(total_amount - amount_paid, 2)

    product = Product(
        name=payload.name.strip(),
        model=payload.model.strip() if payload.model else None,
        cost_price=product_cost_price,
        selling_price=payload.selling_price,
        stock=stock,
        is_curtain=1 if payload.is_curtain else 0,
        number_of_curtains=payload.number_of_curtains if payload.is_curtain else None,
        pieces_per_curtain=payload.pieces_per_curtain if payload.is_curtain else None,
        per_piece_price=payload.per_piece_price if payload.is_curtain else None,
        last_purchase_payment_type=payload.transaction_type,
        last_purchase_remaining=remaining if payload.transaction_type == "CREDIT" else 0.0,
    )
    db.add(product)
    db.flush()

    code, image_path = _generate_barcode(product.id)
    if code:
        product.barcode_number = code
        product.barcode_image_path = image_path

    invoice_number = payload.reference_no or f"ADD-{product.id}-{int(time.time())}"
    purchase_date = payload.date if payload.date else datetime.utcnow()
    if isinstance(purchase_date, date) and not isinstance(purchase_date, datetime):
        purchase_date = datetime(purchase_date.year, purchase_date.month, purchase_date.day)
    purchase = Purchase(
        supplier_id=supplier.id,
        invoice_number=invoice_number,
        purchase_date=purchase_date,
        total_amount=purchase_subtotal,
        discount=0.0,
        tax=0.0,
        final_amount=total_amount,
        payment_type="CREDIT" if payload.transaction_type == "CREDIT" else "CASH",
    )
    db.add(purchase)
    db.flush()

    db.add(PurchaseItem(
        purchase_id=purchase.id,
        product_id=product.id,
        quantity=stock,
        purchase_price=product_cost_price,
        total_price=purchase_subtotal,
    ))

    payment_type_label = "CREDIT" if payload.transaction_type == "CREDIT" else "CASH"
    entries = [
        {"account_name": "Inventory", "account_type": "asset", "debit": total_amount, "credit": 0.0},
    ]
    if payload.transaction_type == "CREDIT":
        entries.append({
            "account_name": "Accounts Payable",
            "account_type": "liability",
            "debit": 0.0,
            "credit": total_amount,
        })
    else:
        entries.append({
            "account_name": "Cash on Hand",
            "account_type": "asset",
            "debit": 0.0,
            "credit": total_amount,
        })

    try:
        create_journal_entry(
            db,
            description=f"Purchase — {product.name} ({payment_type_label})",
            entries=entries,
            reference_type="purchase",
            reference_id=purchase.id,
        )
    except Exception as e:
        logger.error(f"Journal entry failed: {e}", exc_info=True)

    if payload.transaction_type == "CREDIT":
        credit_account = CreditAccount(
            party_type="supplier",
            party_id=supplier.id,
            total_amount=total_amount,
            paid_amount=amount_paid,
            balance=remaining,
            status="paid" if remaining <= 0 else ("partial" if amount_paid > 0 else "pending"),
        )
        db.add(credit_account)
        db.flush()

        db.add(CreditTransaction(
            credit_account_id=credit_account.id,
            type="purchase",
            amount=total_amount,
            description=f"Purchase of {product.name}",
            reference_id=product.id,
        ))

        if amount_paid > 0:
            db.add(CreditTransaction(
                credit_account_id=credit_account.id,
                type="payment",
                amount=amount_paid,
                description="Initial payment",
                reference_id=product.id,
            ))
            db.add(CreditPayment(
                credit_account_id=credit_account.id,
                amount=amount_paid,
                method="cash",
            ))

        db.add(CreditItem(
            credit_account_id=credit_account.id,
            product_id=product.id,
            quantity=stock,
            price=product_cost_price,
            total=purchase_subtotal,
        ))

        _append_ledger_entry(
            db, "supplier", supplier.id,
            debit=0, credit=total_amount,
            reference_type="purchase", reference_id=purchase.id,
        )

        if amount_paid > 0:
            _append_ledger_entry(
                db, "supplier", supplier.id,
                debit=amount_paid, credit=0,
                reference_type="payment", reference_id=credit_account.id,
            )

    log_activity(
        db, "product_add",
        f"Product added: {product.name} — Rs. {total_amount:.2f} ({payment_type_label})",
        reference_id=product.id,
        reference_type="product",
        amount=total_amount,
    )

    db.commit()
    db.refresh(product)

    return {
        "id": product.id,
        "name": product.name,
        "model": product.model,
        "sku": product.sku,
        "cost_price": float(product.cost_price),
        "selling_price": float(product.selling_price),
        "stock": int(product.stock),
        "is_curtain": bool(product.is_curtain),
        "number_of_curtains": product.number_of_curtains,
        "pieces_per_curtain": product.pieces_per_curtain,
        "per_piece_price": product.per_piece_price,
        "last_purchase_payment_type": product.last_purchase_payment_type,
        "last_purchase_remaining": float(product.last_purchase_remaining),
        "barcode_number": product.barcode_number,
        "supplier_id": supplier.id,
        "supplier_name": supplier.name,
        "purchase_id": purchase.id,
        "invoice_number": purchase.invoice_number,
        "total_amount": total_amount,
        "amount_paid": amount_paid,
        "remaining": remaining,
        "payment_type": payment_type_label,
    }
