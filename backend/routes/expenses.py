from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from backend.services import expense_service
from backend.services.accounting_service import EXPENSE_TYPE_GL_MAP

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/expense-types")
def get_expense_types():
    return {
        "vehicle": ["Petrol / Fuel", "Vehicle Maintenance", "Toll / Parking"],
        "general": ["Labour / Loading", "Food / Meals", "Office Supplies", "Electricity", "Rent", "Salary", "Repair", "Other"],
    }


@router.post("/generate-voucher-no")
def generate_voucher_no(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return {"voucher_no": expense_service._generate_voucher_no(db)}


@router.get("", response_model=list[ExpenseRead])
def list_expenses(
    expense_date_from: str | None = Query(None),
    expense_date_to: str | None = Query(None),
    expense_type: str | None = Query(None),
    employee_name: str | None = Query(None),
    payment_method: str | None = Query(None),
    status: str | None = Query(None),
    vehicle_only: bool = Query(False),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return expense_service.list_expenses(db)


@router.get("/{expense_id}", response_model=ExpenseRead)
def get_expense(expense_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    expense = expense_service.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return expense_service.create_expense(db, payload)


@router.put("/{expense_id}", response_model=ExpenseRead)
def update_expense(expense_id: int, payload: ExpenseUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    expense = expense_service.update_expense(db, expense_id, payload)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    ok = expense_service.delete_expense(db, expense_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
