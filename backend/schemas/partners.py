from pydantic import BaseModel, Field


class OwnershipUpdate(BaseModel):
    ownership_percentage: float = Field(gt=0, le=100)


class PartnerRead(BaseModel):
    user_id: int
    name: str
    email: str
    ownership_percentage: float
    profit_share: float
