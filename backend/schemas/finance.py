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
    accounting: dict = {}  # Accounting-based P&L data


class AccountingData(BaseModel):
    name: str
    balance: float


class ProfitLossStatement(BaseModel):
    revenue: float
    expenses: float
    profit: float
    revenue_breakdown: dict = {}
    expense_breakdown: dict = {}


class BalanceSheet(BaseModel):
    assets: float
    liabilities: float
    equity: float
    assets_breakdown: dict = {}
    liabilities_breakdown: dict = {}
    equity_breakdown: dict = {}
