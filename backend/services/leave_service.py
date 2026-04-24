from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.leave import Leave
from backend.schemas.leave_schema import LeaveApprove, LeaveCreate


def create_leave(db: Session, payload: LeaveCreate) -> Leave:
    leave = Leave(
        employee_id=payload.employee_id,
        type=payload.type,
        start_date=date.fromisoformat(payload.start_date),   # date object required by SQLite Column(Date)
        end_date=date.fromisoformat(payload.end_date),
        reason=payload.reason,
        status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


def approve_leave(db: Session, leave_id: int, payload: LeaveApprove, approver_id: int) -> Leave:
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise ValueError("Leave not found")
    if leave.status != "pending":
        raise ValueError("Leave is already processed")
    if payload.status not in ("approved", "rejected"):
        raise ValueError("Status must be 'approved' or 'rejected'")

    leave.status = payload.status
    leave.approved_by = approver_id
    db.commit()
    db.refresh(leave)
    return leave


def list_leaves(
    db: Session,
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
) -> list[Leave]:
    q = db.query(Leave)
    if employee_id:
        q = q.filter(Leave.employee_id == employee_id)
    if status:
        q = q.filter(Leave.status == status)
    return q.order_by(Leave.id.desc()).all()


def get_approved_leave_days(db: Session, employee_id: int, month: str) -> int:
    """
    Returns total approved leave days for an employee in a given month (YYYY-MM).
    Used by payroll to exclude approved leaves from absent count.
    """
    try:
        year, mon = map(int, month.split("-"))
    except (ValueError, AttributeError) as e:
        raise ValueError(f"Invalid month format: expected YYYY-MM, got '{month}'")
    
    leaves = (
        db.query(Leave)
        .filter(
            Leave.employee_id == employee_id,
            Leave.status == "approved",
        )
        .all()
    )
    total = 0
    for leave in leaves:
        try:
            start = date.fromisoformat(str(leave.start_date)) if isinstance(leave.start_date, str) else leave.start_date
            end = date.fromisoformat(str(leave.end_date)) if isinstance(leave.end_date, str) else leave.end_date
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid date format in leave record {leave.id}: {str(e)}")
        
        for n in range((end - start).days + 1):
            d = start + timedelta(days=n)
            if d.year == year and d.month == mon:
                total += 1
    return total


def get_unpaid_leave_days(db: Session, employee_id: int, month: str) -> int:
    """Returns total approved UNPAID leave days for payroll deduction."""
    try:
        year, mon = map(int, month.split("-"))
    except (ValueError, AttributeError) as e:
        raise ValueError(f"Invalid month format: expected YYYY-MM, got '{month}'")
    
    leaves = (
        db.query(Leave)
        .filter(
            Leave.employee_id == employee_id,
            Leave.status == "approved",
            Leave.type == "unpaid",
        )
        .all()
    )
    total = 0
    for leave in leaves:
        try:
            start = date.fromisoformat(str(leave.start_date)) if isinstance(leave.start_date, str) else leave.start_date
            end = date.fromisoformat(str(leave.end_date)) if isinstance(leave.end_date, str) else leave.end_date
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid date format in leave record {leave.id}: {str(e)}")
        
        for n in range((end - start).days + 1):
            d = start + timedelta(days=n)
            if d.year == year and d.month == mon:
                total += 1
    return total
