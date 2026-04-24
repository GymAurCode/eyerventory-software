"""
Accounting Service: Handles journal entries and account management for proper financial recording.
Implements double-entry bookkeeping principles to ensure financial accuracy.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.account import Account
from backend.models.journal import JournalEntry, JournalItem


def get_or_create_account(db: Session, name: str, acc_type: str) -> Account:
    """Get existing account or create if not found."""
    account = db.query(Account).filter(Account.name == name).first()
    if not account:
        account = Account(name=name, type=acc_type)
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


def create_journal_entry(
    db: Session,
    description: str,
    entries: list[dict],  # [{"account_name": "...", "account_type": "...", "debit": 0, "credit": 0}]
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None,
) -> JournalEntry:
    """
    Create a journal entry with multiple items (double-entry bookkeeping).
    
    Validates that debits = credits.
    
    Args:
        db: Database session
        description: Description of the journal entry (e.g., "Salary Payment for 2025-01")
        entries: List of dicts with account_name, account_type, debit, credit
        reference_type: Type of reference (e.g., "payroll", "expense")
        reference_id: ID of the reference (e.g., payroll_id)
    
    Returns:
        JournalEntry object
    
    Raises:
        ValueError: If debits don't equal credits
    """
    # Validate double-entry bookkeeping
    total_debit = sum(e.get("debit", 0) for e in entries)
    total_credit = sum(e.get("credit", 0) for e in entries)
    
    if abs(total_debit - total_credit) > 0.01:  # Allow small floating point differences
        raise ValueError(
            f"Journal entry not balanced: Debits ({total_debit}) != Credits ({total_credit})"
        )
    
    # Create journal entry
    journal = JournalEntry(
        date=datetime.utcnow(),
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(journal)
    db.flush()  # Ensure journal has an ID
    
    # Create journal items (account entries)
    for entry in entries:
        account = get_or_create_account(
            db,
            entry["account_name"],
            entry["account_type"]
        )
        
        item = JournalItem(
            journal_id=journal.id,
            account_id=account.id,
            debit=entry.get("debit", 0.0),
            credit=entry.get("credit", 0.0),
        )
        db.add(item)
    
    db.commit()
    db.refresh(journal)
    return journal


def record_payroll_payment(
    db: Session,
    payroll_id: int,
    employee_name: str,
    month: str,
    net_salary: float,
    use_accrual: bool = False,
) -> JournalEntry:
    """
    Record a payroll payment in the journal.
    
    Simple Approach (Cash Basis):
        DR Salaries Expense → net_salary
        CR Cash/Bank → net_salary
    
    Accrual Approach:
        DR Salary Payable → net_salary
        CR Cash/Bank → net_salary
    
    Args:
        db: Database session
        payroll_id: ID of the payroll record
        employee_name: Name of the employee (for description)
        month: Month in YYYY-MM format
        net_salary: Net salary to be paid
        use_accrual: If True, use accrual method; else cash method
    
    Returns:
        JournalEntry object
    """
    description = f"Salary Payment for {employee_name} - {month}"
    
    if use_accrual:
        # Accrual: reduce liability, reduce cash
        entries = [
            {
                "account_name": "Salary Payable",
                "account_type": "liability",
                "debit": net_salary,
                "credit": 0.0,
            },
            {
                "account_name": "Bank",
                "account_type": "asset",
                "debit": 0.0,
                "credit": net_salary,
            },
        ]
    else:
        # Cash basis: expense immediately, reduce cash
        entries = [
            {
                "account_name": "Salaries Expense",
                "account_type": "expense",
                "debit": net_salary,
                "credit": 0.0,
            },
            {
                "account_name": "Bank",
                "account_type": "asset",
                "debit": 0.0,
                "credit": net_salary,
            },
        ]
    
    return create_journal_entry(
        db,
        description,
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
    """
    Record a payroll accrual when payroll is generated (not yet paid).
    
    Used for accrual accounting:
        DR Salaries Expense → net_salary
        CR Salary Payable → net_salary
    
    Args:
        db: Database session
        payroll_id: ID of the payroll record
        employee_name: Name of the employee
        month: Month in YYYY-MM format
        net_salary: Net salary amount
    
    Returns:
        JournalEntry object
    """
    description = f"Salary Accrual for {employee_name} - {month}"
    
    entries = [
        {
            "account_name": "Salaries Expense",
            "account_type": "expense",
            "debit": net_salary,
            "credit": 0.0,
        },
        {
            "account_name": "Salary Payable",
            "account_type": "liability",
            "debit": 0.0,
            "credit": net_salary,
        },
    ]
    
    return create_journal_entry(
        db,
        description,
        entries,
        reference_type="payroll_accrual",
        reference_id=payroll_id,
    )


def get_account_balance(db: Session, account_name: str) -> float:
    """
    Get the balance of an account (Debits - Credits for assets/expenses, Credits - Debits for liabilities/equity/revenue).
    
    Accounting Rule:
    - Assets/Expenses: Balance = Sum(Debits) - Sum(Credits)
    - Liabilities/Equity/Revenue: Balance = Sum(Credits) - Sum(Debits)
    
    Args:
        db: Database session
        account_name: Name of the account
    
    Returns:
        Account balance as float
    """
    account = db.query(Account).filter(Account.name == account_name).first()
    if not account:
        return 0.0
    
    result = db.query(
        func.coalesce(func.sum(JournalItem.debit), 0.0),
        func.coalesce(func.sum(JournalItem.credit), 0.0),
    ).filter(JournalItem.account_id == account.id).one()
    
    total_debit, total_credit = result
    
    # Calculate balance based on account type
    if account.type in ("asset", "expense"):
        return float(total_debit - total_credit)
    else:  # liability, equity, revenue
        return float(total_credit - total_debit)


def get_account_balances_by_type(db: Session, acc_type: str) -> dict[str, float]:
    """
    Get all account balances for a specific account type.
    
    Args:
        db: Database session
        acc_type: Account type (asset, liability, equity, revenue, expense)
    
    Returns:
        Dictionary mapping account names to balances
    """
    accounts = db.query(Account).filter(Account.type == acc_type).all()
    return {acc.name: get_account_balance(db, acc.name) for acc in accounts}


def calculate_profit_loss(db: Session) -> dict:
    """
    Calculate Profit & Loss using journal entries.
    
    Formula:
        Total Revenue = Sum of Credits in Revenue accounts
        Total Expenses = Sum of Debits in Expense accounts
        Net Profit = Total Revenue - Total Expenses
    
    Returns:
        {
            "revenue": float,
            "expenses": float,
            "profit": float,
            "accounts": {
                "revenue": {...},
                "expenses": {...},
            }
        }
    """
    revenue_accounts = get_account_balances_by_type(db, "revenue")
    expense_accounts = get_account_balances_by_type(db, "expense")
    
    total_revenue = sum(revenue_accounts.values())
    total_expenses = sum(expense_accounts.values())
    profit = total_revenue - total_expenses
    
    return {
        "revenue": float(total_revenue),
        "expenses": float(total_expenses),
        "profit": float(profit),
        "revenue_breakdown": revenue_accounts,
        "expense_breakdown": expense_accounts,
    }


def get_balance_sheet(db: Session) -> dict:
    """
    Get Balance Sheet using journal entries.
    
    Formula:
        Assets = Sum of all asset accounts
        Liabilities = Sum of all liability accounts
        Equity = Sum of all equity accounts
        Assets = Liabilities + Equity (fundamental equation)
    
    Returns:
        {
            "assets": float,
            "liabilities": float,
            "equity": float,
            "accounts": {...}
        }
    """
    assets = get_account_balances_by_type(db, "asset")
    liabilities = get_account_balances_by_type(db, "liability")
    equity = get_account_balances_by_type(db, "equity")
    
    total_assets = sum(assets.values())
    total_liabilities = sum(liabilities.values())
    total_equity = sum(equity.values())
    
    return {
        "assets": float(total_assets),
        "liabilities": float(total_liabilities),
        "equity": float(total_equity),
        "assets_breakdown": assets,
        "liabilities_breakdown": liabilities,
        "equity_breakdown": equity,
    }
