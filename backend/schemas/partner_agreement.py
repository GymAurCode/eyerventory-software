from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class PartnerAgreementCreate(BaseModel):
    user_id: int
    agreement_start_date: date
    agreement_end_date: Optional[date] = None
    duration_value: Optional[int] = None
    duration_unit: Optional[str] = None
    has_investment: bool = False
    investment_amount: Optional[float] = None
    profit_share_percent: float = Field(gt=0, le=100)
    status: str = "active"
    notes: Optional[str] = None


class PartnerAgreementUpdate(BaseModel):
    agreement_start_date: Optional[date] = None
    agreement_end_date: Optional[date] = None
    duration_value: Optional[int] = None
    duration_unit: Optional[str] = None
    has_investment: Optional[bool] = None
    investment_amount: Optional[float] = None
    profit_share_percent: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PartnerAgreementRead(BaseModel):
    id: int
    user_id: int
    agreement_start_date: date
    agreement_end_date: Optional[date] = None
    duration_value: Optional[int] = None
    duration_unit: Optional[str] = None
    has_investment: bool
    investment_amount: Optional[float] = None
    profit_share_percent: float
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
