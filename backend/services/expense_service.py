from sqlalchemy.orm import Session

from backend.models.expense import Expense
from backend.schemas.expense import ExpenseCreate, ExpenseUpdate


def list_expenses(db: Session):
    return db.query(Expense).order_by(Expense.expense_date.desc()).all()


def create_expense(db: Session, payload: ExpenseCreate):
    expense = Expense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, expense_id: int, payload: ExpenseUpdate):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        return None
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense_id: int) -> bool:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        return False
    db.delete(expense)
    db.commit()
    return True
