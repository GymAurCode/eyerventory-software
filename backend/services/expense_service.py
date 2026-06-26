from datetime import date

from sqlalchemy.orm import Session

from backend.models.expense import Expense, ExpenseItem, ExpenseVehicle
from backend.schemas.expense import ExpenseCreate, ExpenseUpdate
from backend.services import accounting_service


def _generate_voucher_no(db: Session) -> str:
    last = db.query(Expense.voucher_no).filter(
        Expense.voucher_no.isnot(None)
    ).order_by(Expense.id.desc()).first()
    if last and last[0]:
        try:
            num = int(last[0].split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"EXP-{num:04d}"


def list_expenses(db: Session):
    return db.query(Expense).order_by(Expense.expense_date.desc()).all()


def get_expense(db: Session, expense_id: int):
    return db.query(Expense).filter(Expense.id == expense_id).first()


def create_expense(db: Session, payload: ExpenseCreate):
    voucher = payload.voucher_no or _generate_voucher_no(db)

    total = sum(item.amount for item in payload.items)

    expense = Expense(
        category="General",
        voucher_no=voucher,
        employee_name=payload.employee_name,
        remarks=payload.remarks,
        expense_date=payload.expense_date,
        payment_method=payload.payment_method,
        reimbursement_pending=payload.reimbursement_pending,
        total_amount=total,
    )
    db.add(expense)
    db.flush()

    for item in payload.items:
        db.add(ExpenseItem(
            expense_id=expense.id,
            expense_type=item.expense_type,
            description=item.description,
            amount=item.amount,
        ))

    if payload.vehicle:
        db.add(ExpenseVehicle(
            expense_id=expense.id,
            vehicle_name=payload.vehicle.vehicle_name,
            vehicle_type=payload.vehicle.vehicle_type,
            driver_name=payload.vehicle.driver_name,
            trip_purpose=payload.vehicle.trip_purpose,
        ))

    db.flush()

    accounting_service.record_expense(
        db,
        expense_id=expense.id,
        voucher_no=voucher,
        items=[{"expense_type": it.expense_type, "amount": it.amount, "description": it.description} for it in payload.items],
        payment_method=payload.payment_method,
        total_amount=total,
    )

    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, expense_id: int, payload: ExpenseUpdate):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        return None

    update_data = payload.model_dump(exclude_none=True, exclude={"items", "vehicle"})
    for key, value in update_data.items():
        setattr(expense, key, value)

    if payload.items is not None:
        db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense_id).delete()
        for item in payload.items:
            db.add(ExpenseItem(
                expense_id=expense.id,
                expense_type=item.expense_type,
                description=item.description,
                amount=item.amount,
            ))
        expense.total_amount = sum(it.amount for it in payload.items)

    if payload.vehicle is not None:
        db.query(ExpenseVehicle).filter(ExpenseVehicle.expense_id == expense_id).delete()
        db.add(ExpenseVehicle(
            expense_id=expense.id,
            vehicle_name=payload.vehicle.vehicle_name,
            vehicle_type=payload.vehicle.vehicle_type,
            driver_name=payload.vehicle.driver_name,
            trip_purpose=payload.vehicle.trip_purpose,
        ))
    elif payload.vehicle is None and payload.items is not None:
        existing_vehicle = db.query(ExpenseVehicle).filter(ExpenseVehicle.expense_id == expense_id).first()
        if existing_vehicle and not any(it.expense_type in ("Petrol / Fuel", "Vehicle Maintenance", "Toll / Parking") for it in payload.items):
            db.delete(existing_vehicle)

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
