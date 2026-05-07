from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.credit import CreditAccount, CreditItem, CreditTransaction, LedgerEntry, CreditPayment
from backend.models.customer import Customer
from backend.models.product import Product
from backend.models.sale import Sale
from backend.models.supplier import Supplier
from backend.services.accounting_service import create_journal_entry


def _party_name(db: Session, party_type: str, party_id: int) -> str:
    if party_type == "customer":
        row = db.query(Customer).filter(Customer.id == party_id).first()
    else:
        row = db.query(Supplier).filter(Supplier.id == party_id).first()
    if not row:
        raise ValueError(f"{party_type.title()} not found")
    return row.name


def _status(balance: float, total: float) -> str:
    if balance <= 0:
        return "paid"
    if balance < total:
        return "partial"
    return "pending"


def append_ledger_entry(
    db: Session,
    party_type: str,
    party_id: int,
    debit: float,
    credit: float,
    reference_type: str,
    reference_id: int | None,
):
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


def create_credit_account(
    db: Session,
    party_type: str,
    party_id: int,
    amount: float,
    paid_amount: float,
    reference_type: str,
    reference_id: int | None,
    description: str | None = None,
    due_date: datetime | None = None,
    items: list[dict] | None = None,
):
    _party_name(db, party_type, party_id)
    paid_amount = float(paid_amount or 0)
    amount = float(amount)
    if paid_amount > amount:
        raise ValueError("Paid amount cannot exceed total amount")
    balance = round(amount - paid_amount, 2)
    account = CreditAccount(
        party_type=party_type,
        party_id=party_id,
        total_amount=amount,
        paid_amount=paid_amount,
        balance=balance,
        status=_status(balance, amount),
        due_date=due_date,
    )
    db.add(account)
    db.flush()

    db.add(
        CreditTransaction(
            credit_account_id=account.id,
            type=reference_type,
            amount=amount,
            description=description,
            reference_id=reference_id,
        )
    )
    if paid_amount > 0:
        db.add(
            CreditTransaction(
                credit_account_id=account.id,
                type="payment",
                amount=paid_amount,
                description="Initial payment",
                reference_id=reference_id,
            )
        )
        db.add(CreditPayment(credit_account_id=account.id, amount=paid_amount, method="cash"))

    for item in items or []:
        product = db.query(Product).filter(Product.id == item["product_id"]).first()
        if not product:
            raise ValueError(f"Product {item['product_id']} not found")
        db.add(
            CreditItem(
                credit_account_id=account.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                price=item["price"],
                total=item["quantity"] * item["price"],
            )
        )

    if party_type == "customer":
        append_ledger_entry(db, party_type, party_id, debit=amount, credit=0, reference_type=reference_type, reference_id=reference_id)
        if paid_amount > 0:
            append_ledger_entry(db, party_type, party_id, debit=0, credit=paid_amount, reference_type="payment", reference_id=account.id)
    else:
        append_ledger_entry(db, party_type, party_id, debit=0, credit=amount, reference_type=reference_type, reference_id=reference_id)
        if paid_amount > 0:
            append_ledger_entry(db, party_type, party_id, debit=paid_amount, credit=0, reference_type="payment", reference_id=account.id)

    _record_accounting_for_credit(db, account, reference_type, paid_amount)
    return account


def _record_accounting_for_credit(db: Session, account: CreditAccount, reference_type: str, paid_amount: float):
    if reference_type == "sale":
        create_journal_entry(
            db,
            description=f"Credit sale #{account.id}",
            entries=[
                {"account_name": "Accounts Receivable", "account_type": "asset", "debit": account.total_amount, "credit": 0.0},
                {"account_name": "Sales Revenue", "account_type": "revenue", "debit": 0.0, "credit": account.total_amount},
            ],
            reference_type="sale",
            reference_id=account.id,
        )
        if paid_amount > 0:
            create_journal_entry(
                db,
                description=f"Initial payment on credit sale #{account.id}",
                entries=[
                    {"account_name": "Cash on Hand", "account_type": "asset", "debit": paid_amount, "credit": 0.0},
                    {"account_name": "Accounts Receivable", "account_type": "asset", "debit": 0.0, "credit": paid_amount},
                ],
                reference_type="payment",
                reference_id=account.id,
            )
    elif reference_type == "purchase":
        create_journal_entry(
            db,
            description=f"Credit purchase #{account.id}",
            entries=[
                {"account_name": "Cost of Goods Sold", "account_type": "expense", "debit": account.total_amount, "credit": 0.0},
                {"account_name": "Accounts Payable", "account_type": "liability", "debit": 0.0, "credit": account.total_amount},
            ],
            reference_type="purchase",
            reference_id=account.id,
        )


def record_payment(db: Session, credit_account_id: int, amount: float, method: str, description: str | None):
    account = db.query(CreditAccount).filter(CreditAccount.id == credit_account_id).first()
    if not account:
        raise ValueError("Credit account not found")
    amount = float(amount)
    if amount > float(account.balance):
        raise ValueError("Overpayment is not allowed")
    if amount <= 0:
        raise ValueError("Payment amount must be greater than zero")

    payment = CreditPayment(credit_account_id=credit_account_id, amount=amount, method=method)
    db.add(payment)
    db.add(
        CreditTransaction(
            credit_account_id=credit_account_id,
            type="payment",
            amount=amount,
            description=description or "Payment posted",
            reference_id=credit_account_id,
        )
    )

    account.paid_amount = round(float(account.paid_amount) + amount, 2)
    account.balance = round(float(account.total_amount) - float(account.paid_amount), 2)
    if account.balance < 0:
        raise ValueError("Negative balance is not allowed")
    account.status = _status(account.balance, account.total_amount)

    if account.party_type == "customer":
        append_ledger_entry(db, account.party_type, account.party_id, debit=0, credit=amount, reference_type="payment", reference_id=payment.id)
        create_journal_entry(
            db,
            description=f"Credit received for account #{account.id}",
            entries=[
                {"account_name": "Cash on Hand", "account_type": "asset", "debit": amount, "credit": 0.0},
                {"account_name": "Accounts Receivable", "account_type": "asset", "debit": 0.0, "credit": amount},
            ],
            reference_type="payment",
            reference_id=payment.id,
        )
    else:
        append_ledger_entry(db, account.party_type, account.party_id, debit=amount, credit=0, reference_type="payment", reference_id=payment.id)
        create_journal_entry(
            db,
            description=f"Credit paid for supplier account #{account.id}",
            entries=[
                {"account_name": "Accounts Payable", "account_type": "liability", "debit": amount, "credit": 0.0},
                {"account_name": "Bank", "account_type": "asset", "debit": 0.0, "credit": amount},
            ],
            reference_type="payment",
            reference_id=payment.id,
        )

    return account


def list_credits(db: Session, party_type: str | None = None, status: str | None = None):
    q = db.query(CreditAccount).order_by(CreditAccount.id.desc())
    if party_type:
        q = q.filter(CreditAccount.party_type == party_type)
    if status:
        q = q.filter(CreditAccount.status == status)
    return q.all()


def get_credit_detail(db: Session, credit_id: int):
    account = db.query(CreditAccount).filter(CreditAccount.id == credit_id).first()
    if not account:
        return None
    transactions = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.credit_account_id == credit_id)
        .order_by(CreditTransaction.id.desc())
        .all()
    )
    items = db.query(CreditItem).filter(CreditItem.credit_account_id == credit_id).all()
    payments = (
        db.query(CreditPayment)
        .filter(CreditPayment.credit_account_id == credit_id)
        .order_by(CreditPayment.id.desc())
        .all()
    )
    products = {p.id: p.name for p in db.query(Product.id, Product.name).filter(Product.id.in_([i.product_id for i in items])).all()}
    return account, transactions, items, payments, products, _party_name(db, account.party_type, account.party_id)


def ledger_for_party(db: Session, party_type: str, party_id: int):
    return (
        db.query(LedgerEntry)
        .filter(LedgerEntry.party_type == party_type, LedgerEntry.party_id == party_id)
        .order_by(LedgerEntry.id.asc())
        .all()
    )


def credit_summary(db: Session):
    now = datetime.utcnow()
    receivable = db.query(func.coalesce(func.sum(CreditAccount.balance), 0.0)).filter(CreditAccount.party_type == "customer").scalar() or 0.0
    payable = db.query(func.coalesce(func.sum(CreditAccount.balance), 0.0)).filter(CreditAccount.party_type == "supplier").scalar() or 0.0
    overdue = (
        db.query(func.coalesce(func.sum(CreditAccount.balance), 0.0))
        .filter(CreditAccount.due_date.isnot(None), CreditAccount.due_date < now, CreditAccount.balance > 0)
        .scalar()
        or 0.0
    )
    recent = (
        db.query(CreditAccount)
        .order_by(CreditAccount.created_at.desc())
        .limit(10)
        .count()
    )
    cust_rows = db.query(CreditAccount.party_id, func.sum(CreditAccount.balance)).filter(CreditAccount.party_type == "customer").group_by(CreditAccount.party_id).all()
    sup_rows = db.query(CreditAccount.party_id, func.sum(CreditAccount.balance)).filter(CreditAccount.party_type == "supplier").group_by(CreditAccount.party_id).all()
    customers = {c.id: c.name for c in db.query(Customer).all()}
    suppliers = {s.id: s.name for s in db.query(Supplier).all()}
    cash_sales = db.query(func.coalesce(func.sum(Sale.revenue), 0.0)).filter(Sale.payment_type == "CASH").scalar() or 0.0
    credit_sales = db.query(func.coalesce(func.sum(Sale.revenue), 0.0)).filter(Sale.payment_type == "CREDIT").scalar() or 0.0
    return {
        "total_receivable": float(receivable),
        "total_payable": float(payable),
        "overdue_amount": float(overdue),
        "recent_credits": int(recent),
        "receivable_by_customer": [{"party_id": pid, "name": customers.get(pid, f"Customer #{pid}"), "balance": float(bal)} for pid, bal in cust_rows],
        "payable_by_supplier": [{"party_id": pid, "name": suppliers.get(pid, f"Supplier #{pid}"), "balance": float(bal)} for pid, bal in sup_rows],
        "cash_sales_total": float(cash_sales),
        "credit_sales_total": float(credit_sales),
    }
