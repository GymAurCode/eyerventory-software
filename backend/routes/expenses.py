from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from backend.services import expense_service

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=list[ExpenseRead])
def list_expenses(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return expense_service.list_expenses(db)


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
