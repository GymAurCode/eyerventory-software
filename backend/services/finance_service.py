from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.expense import Expense
from backend.models.hr_payment import HRPayment
from backend.models.sale import Sale
from backend.services.settings_service import get_donation_settings


def _get_salary_expense(db: Session) -> float:
    """
    Salary expense = SUM of all active (non-reversed) HR payments.
    HR Payments is the SINGLE source of truth for salary cash flow.
    Payroll records are calculation-only and have NO financial impact.
    """
    result = db.query(
        func.coalesce(func.sum(HRPayment.amount), 0.0)
    ).filter(HRPayment.is_reversed == 0).scalar()
    return float(result)


def get_finance_summary(db: Session) -> dict:
    """
    Financial summary.
    - Revenue / Cost from sales
    - Operational expenses from expenses table
    - Salary expenses from HR payments ONLY (not payroll)
    """
    revenue, cost = db.query(
        func.coalesce(func.sum(Sale.revenue), 0.0),
        func.coalesce(func.sum(Sale.cost), 0.0),
    ).one()

    operational_expenses = float(
        db.query(func.coalesce(func.sum(Expense.amount), 0.0)).scalar()
    )
    salary_expenses = _get_salary_expense(db)
    total_expenses = operational_expenses + salary_expenses

    raw_profit = float(revenue - cost) - total_expenses
    donation = get_donation_settings(db)
    donation_amount = raw_profit * (donation["percentage"] / 100) if donation["enabled"] else 0.0
    distributable_profit = raw_profit - donation_amount

    return {
        "total_revenue": float(revenue),
        "total_cost": float(cost),
        "total_expenses": total_expenses,
        "operational_expenses": operational_expenses,
        "salary_expenses": salary_expenses,
        "raw_profit": raw_profit,
        "donation_enabled": donation["enabled"],
        "donation_percentage": donation["percentage"],
        "donation_amount": float(donation_amount),
        "total_profit": float(distributable_profit),
        "distributable_profit": float(distributable_profit),
    }


def get_profit_loss(db: Session) -> dict:
    """
    P&L statement.
    Expenses breakdown:
      - Operational Expenses (from expenses table)
      - Salaries Expense (from hr_payments ONLY — reversed payments excluded)
    """
    revenue, cost = db.query(
        func.coalesce(func.sum(Sale.revenue), 0.0),
        func.coalesce(func.sum(Sale.cost), 0.0),
    ).one()

    operational_expenses = float(
        db.query(func.coalesce(func.sum(Expense.amount), 0.0)).scalar()
    )
    salary_expenses = _get_salary_expense(db)

    total_revenue = float(revenue)
    total_expenses = float(cost) + operational_expenses + salary_expenses
    profit = total_revenue - total_expenses

    return {
        "revenue": total_revenue,
        "expenses": total_expenses,
        "profit": profit,
        "revenue_breakdown": {
            "Sales Revenue": total_revenue,
        },
        "expense_breakdown": {
            "Cost of Goods Sold": float(cost),
            "Operational Expenses": operational_expenses,
            "Salaries Expense": salary_expenses,
        },
    }
