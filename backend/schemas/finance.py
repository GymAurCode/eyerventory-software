from pydantic import BaseModel


class FinanceSummary(BaseModel):
    total_revenue: float
    total_cost: float
    total_expenses: float
    raw_profit: float
    donation_enabled: bool
    donation_percentage: float
    donation_amount: float
    total_profit: float
    distributable_profit: float
