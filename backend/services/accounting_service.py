"""
Double-Entry Accounting Engine
================================
Every financial event creates balanced journal entries (DR = CR).

Account normal balances:
  ASSET    → debit  (balance = debits - credits)
  EXPENSE  → debit  (balance = debits - credits)
  LIABILITY→ credit (balance = credits - debits)
  EQUITY   → credit (balance = credits - debits)
  REVENUE  → credit (balance = credits - debits)
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.account import Account
from backend.models.journal import JournalEntry, JournalItem

# ---------------------------------------------------------------------------
# Default Chart of Accounts (code → name, type)
# ---------------------------------------------------------------------------
DEFAULT_ACCOUNTS = [
    ("1001", "Cash on Hand",              "asset"),
    ("1002", "Bank",                      "asset"),
    ("1003", "Petty Cash Account",        "asset"),
    ("1100", "Accounts Receivable",       "asset"),
    ("1200", "Inventory",                 "asset"),
    ("2001", "Accounts Payable",          "liability"),
    ("2100", "Salary Payable",            "liability"),
    ("2200", "Employee Payable Account",  "liability"),
    ("4001", "Sales Revenue",             "revenue"),
    ("5001", "Cost of Goods Sold",        "expense"),
    ("5002", "Salaries Expense",          "expense"),
    ("5003", "Operational Expenses",      "expense"),
]

# Expense Type → GL Account Name mapping
EXPENSE_TYPE_GL_MAP = {
    "Petrol / Fuel":         "Fuel & Conveyance Expense",
    "Vehicle Maintenance":   "Vehicle Maintenance Expense",
    "Toll / Parking":        "Conveyance Expense",
    "Labour / Loading":      "Labour Expense",
    "Food / Meals":          "Meals & Entertainment Expense",
    "Office Supplies":       "Office Supplies Expense",
    "Electricity":           "Utilities Expense",
    "Rent":                  "Rent Expense",
    "Salary":                "Salary Expense",
    "Repair":                "Repair & Maintenance Expense",
    "Other":                 "Miscellaneous Expense",
}

# Payment Method → Credit Account mapping
PAYMENT_METHOD_CREDIT_ACCOUNT = {
    "cash":           ("Petty Cash Account",        "asset"),
    "bank":           ("Bank",                      "asset"),
    "employee_paid":  ("Employee Payable Account",  "liability"),
    "credit":         ("Accounts Payable",          "liability"),
}


# ---------------------------------------------------------------------------
# Account helpers
# ---------------------------------------------------------------------------

def get_or_create_account(db: Session, name: str, acc_type: str) -> Account:
    account = db.query(Account).filter(Account.name == name).first()
    if not account:
        account = Account(name=name, type=acc_type)
        db.add(account)
        db.flush()
    return account


def get_account_by_name(db: Session, name: str) -> Optional[Account]:
    return db.query(Account).filter(Account.name == name).first()


def seed_default_accounts(db: Session) -> None:
    """Idempotently insert default COA rows."""
    for code, name, acc_type in DEFAULT_ACCOUNTS:
        existing = db.query(Account).filter(Account.name == name).first()
        if not existing:
            db.add(Account(code=code, name=name, type=acc_type))
        elif existing.code is None:
            existing.code = code
    db.commit()


# ---------------------------------------------------------------------------
# Core journal entry creator
# ---------------------------------------------------------------------------

def create_journal_entry(
    db: Session,
    description: str,
    entries: list[dict],
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None,
) -> JournalEntry:
    """
    Create a balanced journal entry.

    Each entry dict: {"account_name": str, "account_type": str, "debit": float, "credit": float}
    Raises ValueError if debits ≠ credits.
    """
    total_debit  = sum(float(e.get("debit",  0)) for e in entries)
    total_credit = sum(float(e.get("credit", 0)) for e in entries)

    if abs(total_debit - total_credit) > 0.01:
        raise ValueError(
            f"Unbalanced journal entry: DR {total_debit:.2f} ≠ CR {total_credit:.2f}"
        )

    journal = JournalEntry(
        date=datetime.utcnow(),
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(journal)
    db.flush()

    for e in entries:
        account = get_or_create_account(db, e["account_name"], e["account_type"])
        db.add(JournalItem(
            journal_id=journal.id,
            account_id=account.id,
            debit=float(e.get("debit", 0.0)),
            credit=float(e.get("credit", 0.0)),
        ))

    db.flush()
    return journal


# ---------------------------------------------------------------------------
# Business-event journal recorders
# ---------------------------------------------------------------------------

def record_sale(
    db: Session,
    sale_id: int,
    revenue: float,
    cost: float,
    paid_amount: float,
    payment_type: str,
    product_name: str = "",
) -> JournalEntry:
    """
    CASH sale:
        DR Cash on Hand       revenue
        CR Sales Revenue      revenue
        DR Cost of Goods Sold cost
        CR Inventory          cost

    CREDIT sale:
        DR Accounts Receivable  revenue
        CR Sales Revenue        revenue
        DR Cost of Goods Sold   cost
        CR Inventory            cost

    Partial cash on credit:
        DR Cash on Hand         paid_amount
        DR Accounts Receivable  (revenue - paid_amount)
        CR Sales Revenue        revenue
        DR COGS                 cost
        CR Inventory            cost
    """
    due = revenue - paid_amount
    entries = []

    # Revenue side
    if payment_type == "CASH":
        entries.append({"account_name": "Cash on Hand", "account_type": "asset",
                        "debit": revenue, "credit": 0.0})
    else:
        if paid_amount > 0:
            entries.append({"account_name": "Cash on Hand", "account_type": "asset",
                            "debit": paid_amount, "credit": 0.0})
        if due > 0:
            entries.append({"account_name": "Accounts Receivable", "account_type": "asset",
                            "debit": due, "credit": 0.0})

    entries.append({"account_name": "Sales Revenue", "account_type": "revenue",
                    "debit": 0.0, "credit": revenue})

    # COGS side
    entries.append({"account_name": "Cost of Goods Sold", "account_type": "expense",
                    "debit": cost, "credit": 0.0})
    entries.append({"account_name": "Inventory", "account_type": "asset",
                    "debit": 0.0, "credit": cost})

    return create_journal_entry(
        db,
        f"Sale #{sale_id}" + (f" — {product_name}" if product_name else ""),
        entries,
        reference_type="sale",
        reference_id=sale_id,
    )


def _journal_exists(db: Session, ref_type: str, ref_id: int) -> bool:
    """Check if a journal entry already exists for the given reference."""
    return db.query(JournalEntry).filter(
        JournalEntry.reference_type == ref_type,
        JournalEntry.reference_id == ref_id,
    ).first() is not None


def record_pos_sale(
    db: Session,
    sale_id: int,
    bill_number: str,
    total: float,
    payment_method: str,
    items: list[dict],
) -> JournalEntry:
    """
    POS multi-item sale — double-entry journal.

    Payment-method mapping:
        cash  → DR Cash on Hand / CR Sales Revenue
        card  → DR Bank          / CR Sales Revenue
        other → DR Cash on Hand  / CR Sales Revenue

    Always:
        DR Cost of Goods Sold  / CR Inventory

    Each items dict: {"cost_price": float, "qty": int}
    """
    if _journal_exists(db, "pos_sale", sale_id):
        raise ValueError(f"Journal entry already exists for POS sale #{sale_id}")

    if payment_method == "card":
        debit_account = ("Bank", "asset")
    else:
        debit_account = ("Cash on Hand", "asset")

    total_cost = sum(float(i["cost_price"]) * int(i["qty"]) for i in items)

    entries = [
        {"account_name": debit_account[0], "account_type": debit_account[1],
         "debit": total, "credit": 0.0},
        {"account_name": "Sales Revenue", "account_type": "revenue",
         "debit": 0.0, "credit": total},
        {"account_name": "Cost of Goods Sold", "account_type": "expense",
         "debit": total_cost, "credit": 0.0},
        {"account_name": "Inventory", "account_type": "asset",
         "debit": 0.0, "credit": total_cost},
    ]
    return create_journal_entry(
        db,
        f"POS Sale — {bill_number}",
        entries,
        reference_type="pos_sale",
        reference_id=sale_id,
    )


def record_pos_return(
    db: Session,
    sale_id: int,
    return_id: int,
    bill_number: str,
    total_refund: float,
    original_payment_method: str,
    items: list[dict],
) -> JournalEntry:
    """
    Reverse journal entry for a POS return/refund.

    Reverses both revenue and COGS sides:
        DR Sales Revenue              total_refund
        CR Cash on Hand / Bank        total_refund
        DR Inventory                  total_cost
        CR Cost of Goods Sold         total_cost

    Each items dict: {"cost_price": float, "qty": int}
    """
    if _journal_exists(db, "pos_return", return_id):
        raise ValueError(f"Journal entry already exists for POS return #{return_id}")

    if original_payment_method == "card":
        credit_account = ("Bank", "asset")
    else:
        credit_account = ("Cash on Hand", "asset")

    total_cost = sum(float(i["cost_price"]) * int(i["qty"]) for i in items)

    entries = [
        {"account_name": "Sales Revenue", "account_type": "revenue",
         "debit": total_refund, "credit": 0.0},
        {"account_name": credit_account[0], "account_type": credit_account[1],
         "debit": 0.0, "credit": total_refund},
        {"account_name": "Inventory", "account_type": "asset",
         "debit": total_cost, "credit": 0.0},
        {"account_name": "Cost of Goods Sold", "account_type": "expense",
         "debit": 0.0, "credit": total_cost},
    ]
    return create_journal_entry(
        db,
        f"POS Return — {bill_number}",
        entries,
        reference_type="pos_return",
        reference_id=return_id,
    )


def record_customer_payment(
    db: Session,
    sale_id: int,
    amount: float,
) -> JournalEntry:
    """
    Customer payment received:
        DR Cash on Hand          amount
        CR Accounts Receivable   amount
    """
    return create_journal_entry(
        db,
        f"Customer payment for Sale #{sale_id}",
        [
            {"account_name": "Cash on Hand", "account_type": "asset",
             "debit": amount, "credit": 0.0},
            {"account_name": "Accounts Receivable", "account_type": "asset",
             "debit": 0.0, "credit": amount},
        ],
        reference_type="customer_payment",
        reference_id=sale_id,
    )


def record_expense(
    db: Session,
    expense_id: int,
    voucher_no: str,
    items: list[dict],
    payment_method: str,
    total_amount: float,
) -> JournalEntry:
    """
    Multi-item expense — each item generates a DR line to its mapped GL account.
    Single CR line to the payment method account.

    items: [{"expense_type": str, "amount": float, "description": str|None}]
    """
    credit_account_name, credit_account_type = PAYMENT_METHOD_CREDIT_ACCOUNT.get(
        payment_method, ("Petty Cash Account", "asset")
    )

    entries = []
    for item in items:
        gl_name = EXPENSE_TYPE_GL_MAP.get(item["expense_type"], "Miscellaneous Expense")
        entries.append({
            "account_name": gl_name,
            "account_type": "expense",
            "debit": float(item["amount"]),
            "credit": 0.0,
        })

    entries.append({
        "account_name": credit_account_name,
        "account_type": credit_account_type,
        "debit": 0.0,
        "credit": total_amount,
    })

    return create_journal_entry(
        db,
        f"Expense — {voucher_no}" if voucher_no else f"Expense #{expense_id}",
        entries,
        reference_type="expense",
        reference_id=expense_id,
    )


def record_payroll_payment(
    db: Session,
    payroll_id: int,
    employee_name: str,
    month: str,
    net_salary: float,
    use_accrual: bool = False,
) -> JournalEntry:
    if use_accrual:
        entries = [
            {"account_name": "Salary Payable",   "account_type": "liability",
             "debit": net_salary, "credit": 0.0},
            {"account_name": "Cash on Hand",      "account_type": "asset",
             "debit": 0.0, "credit": net_salary},
        ]
    else:
        entries = [
            {"account_name": "Salaries Expense", "account_type": "expense",
             "debit": net_salary, "credit": 0.0},
            {"account_name": "Cash on Hand",     "account_type": "asset",
             "debit": 0.0, "credit": net_salary},
        ]
    return create_journal_entry(
        db,
        f"Salary Payment — {employee_name} ({month})",
        entries,
        reference_type="payroll",
        reference_id=payroll_id,
    )


def record_payroll_accrual(
    db: Session,
    payroll_id: int,
    employee_name: str,
    month: str,
    net_salary: float,
) -> JournalEntry:
    return create_journal_entry(
        db,
        f"Salary Accrual — {employee_name} ({month})",
        [
            {"account_name": "Salaries Expense", "account_type": "expense",
             "debit": net_salary, "credit": 0.0},
            {"account_name": "Salary Payable",   "account_type": "liability",
             "debit": 0.0, "credit": net_salary},
        ],
        reference_type="payroll_accrual",
        reference_id=payroll_id,
    )


# ---------------------------------------------------------------------------
# Balance / reporting helpers
# ---------------------------------------------------------------------------

def get_account_balance(db: Session, account_name: str) -> float:
    account = db.query(Account).filter(Account.name == account_name).first()
    if not account:
        return 0.0
    dr, cr = db.query(
        func.coalesce(func.sum(JournalItem.debit),  0.0),
        func.coalesce(func.sum(JournalItem.credit), 0.0),
    ).filter(JournalItem.account_id == account.id).one()
    if account.type in ("asset", "expense"):
        return float(dr - cr)
    return float(cr - dr)


def get_account_balances_by_type(db: Session, acc_type: str) -> dict[str, float]:
    accounts = db.query(Account).filter(Account.type == acc_type).all()
    return {acc.name: get_account_balance(db, acc.name) for acc in accounts}


def get_all_account_balances(db: Session) -> list[dict]:
    """Return every account with its current balance — used for Trial Balance."""
    accounts = db.query(Account).order_by(Account.type, Account.name).all()
    result = []
    for acc in accounts:
        dr, cr = db.query(
            func.coalesce(func.sum(JournalItem.debit),  0.0),
            func.coalesce(func.sum(JournalItem.credit), 0.0),
        ).filter(JournalItem.account_id == acc.id).one()
        result.append({
            "id":      acc.id,
            "code":    acc.code or "",
            "name":    acc.name,
            "type":    acc.type,
            "total_debit":  float(dr),
            "total_credit": float(cr),
            "balance": float(dr - cr) if acc.type in ("asset", "expense") else float(cr - dr),
        })
    return result


def calculate_profit_loss(db: Session) -> dict:
    revenue_accounts = get_account_balances_by_type(db, "revenue")
    expense_accounts = get_account_balances_by_type(db, "expense")
    total_revenue  = sum(revenue_accounts.values())
    total_expenses = sum(expense_accounts.values())
    return {
        "revenue":           float(total_revenue),
        "expenses":          float(total_expenses),
        "profit":            float(total_revenue - total_expenses),
        "revenue_breakdown": revenue_accounts,
        "expense_breakdown": expense_accounts,
    }


def get_balance_sheet(db: Session) -> dict:
    assets      = get_account_balances_by_type(db, "asset")
    liabilities = get_account_balances_by_type(db, "liability")
    equity      = get_account_balances_by_type(db, "equity")
    pnl         = calculate_profit_loss(db)
    retained    = pnl["profit"]
    total_equity = sum(equity.values()) + retained
    return {
        "assets":               float(sum(assets.values())),
        "liabilities":          float(sum(liabilities.values())),
        "equity":               float(total_equity),
        "retained_earnings":    float(retained),
        "assets_breakdown":     assets,
        "liabilities_breakdown": liabilities,
        "equity_breakdown":     {**equity, "Retained Earnings": retained},
    }


def get_account_ledger(db: Session, account_id: int) -> list[dict]:
    """Return all journal lines for a specific account, with running balance."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return []

    rows = (
        db.query(JournalItem, JournalEntry)
        .join(JournalEntry, JournalItem.journal_id == JournalEntry.id)
        .filter(JournalItem.account_id == account_id)
        .order_by(JournalEntry.date.asc())
        .all()
    )

    running = 0.0
    ledger = []
    for item, entry in rows:
        if account.type in ("asset", "expense"):
            running += item.debit - item.credit
        else:
            running += item.credit - item.debit
        ledger.append({
            "date":           entry.date.isoformat() if entry.date else None,
            "description":    entry.description,
            "reference_type": entry.reference_type,
            "reference_id":   entry.reference_id,
            "debit":          float(item.debit),
            "credit":         float(item.credit),
            "balance":        round(running, 2),
        })
    return ledger
