from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.expense import Expense
from backend.models.sale import Sale
from backend.services.settings_service import get_donation_settings


def get_finance_summary(db: Session) -> dict:
    revenue, cost = db.query(
        func.coalesce(func.sum(Sale.revenue), 0.0),
        func.coalesce(func.sum(Sale.cost), 0.0),
    ).one()
    expenses = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).scalar()
    raw_profit = float(revenue - cost - expenses)
    donation = get_donation_settings(db)
    donation_amount = raw_profit * (donation["percentage"] / 100) if donation["enabled"] else 0.0
    distributable_profit = raw_profit - donation_amount
    return {
        "total_revenue": float(revenue),
        "total_cost": float(cost),
        "total_expenses": float(expenses),
        "raw_profit": raw_profit,
        "donation_enabled": donation["enabled"],
        "donation_percentage": donation["percentage"],
        "donation_amount": float(donation_amount),
        "total_profit": float(distributable_profit),
        "distributable_profit": float(distributable_profit),
    }
