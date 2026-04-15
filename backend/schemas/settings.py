from pydantic import BaseModel, Field


class DonationSettingsUpdate(BaseModel):
    enabled: bool
    percentage: float = Field(ge=0, le=100)


class DonationSettingsRead(BaseModel):
    enabled: bool
    percentage: float
    donation_amount: float


class CompanySettingsUpdate(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)


class CompanySettingsRead(BaseModel):
    company_name: str


class ClearDataRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
