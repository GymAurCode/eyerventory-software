from datetime import date, datetime

from pydantic import BaseModel, Field


class ExpenseItemCreate(BaseModel):
    expense_type: str = Field(min_length=1, max_length=40)
    description: str | None = Field(default=None, max_length=255)
    amount: float = Field(gt=0)


class ExpenseVehicleCreate(BaseModel):
    vehicle_name: str = Field(min_length=1, max_length=120)
    vehicle_type: str = Field(min_length=1, max_length=20)
    driver_name: str | None = Field(default=None, max_length=120)
    trip_purpose: str | None = Field(default=None, max_length=255)


class ExpenseCreate(BaseModel):
    expense_date: date
    voucher_no: str | None = Field(default=None, max_length=20)
    employee_name: str | None = Field(default=None, max_length=120)
    remarks: str | None = Field(default=None)
    payment_method: str = Field(default="cash")
    reimbursement_pending: bool = False
    items: list[ExpenseItemCreate] = Field(min_length=1)
    vehicle: ExpenseVehicleCreate | None = None


class ExpenseItemRead(BaseModel):
    id: int
    expense_type: str
    description: str | None
    amount: float

    class Config:
        from_attributes = True


class ExpenseVehicleRead(BaseModel):
    id: int
    vehicle_name: str
    vehicle_type: str
    driver_name: str | None
    trip_purpose: str | None

    class Config:
        from_attributes = True


class ExpenseRead(BaseModel):
    id: int
    voucher_no: str | None
    employee_name: str | None
    remarks: str | None
    expense_date: date
    payment_method: str
    reimbursement_pending: bool
    total_amount: float
    created_at: datetime
    items: list[ExpenseItemRead]
    vehicle: ExpenseVehicleRead | None

    class Config:
        from_attributes = True


class ExpenseUpdate(BaseModel):
    expense_date: date | None = None
    voucher_no: str | None = None
    employee_name: str | None = None
    remarks: str | None = None
    payment_method: str | None = None
    reimbursement_pending: bool | None = None
    items: list[ExpenseItemCreate] | None = None
    vehicle: ExpenseVehicleCreate | None = None
