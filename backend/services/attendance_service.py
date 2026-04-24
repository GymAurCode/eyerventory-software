from datetime import date, datetime, time
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.attendance_log import AttendanceLog
from backend.models.employee import Employee
from backend.schemas.attendance import CheckInRequest, CheckOutRequest


def _parse_time(t_str: str) -> time:
    """Parse HH:MM or HH:MM:SS string to time object."""
    if not t_str or not isinstance(t_str, str):
        raise ValueError("Invalid time format: time string required")
    
    parts = t_str.strip().split(":")
    if len(parts) < 2:
        raise ValueError(f"Invalid time format: expected HH:MM or HH:MM:SS, got '{t_str}'")
    
    try:
        hour = int(parts[0])
        minute = int(parts[1])
        second = int(parts[2]) if len(parts) > 2 else 0
        return time(hour, minute, second)
    except ValueError as e:
        raise ValueError(f"Invalid time format '{t_str}': {str(e)}")


def _calculate_late_minutes(employee: Employee, check_in_str: str) -> tuple[str, int]:
    """
    Returns (status, late_minutes).
    Daily employees are always 'present' with 0 late minutes.
    Monthly employees are 'late' if check_in > job_start_time + grace_minutes.
    """
    if employee.employment_type == "daily":
        return "present", 0

    if not employee.job_start_time:
        return "present", 0

    check_in_t = _parse_time(check_in_str)
    start_t = _parse_time(employee.job_start_time)

    # Convert to minutes for comparison
    check_in_mins = check_in_t.hour * 60 + check_in_t.minute
    start_mins = start_t.hour * 60 + start_t.minute
    grace = employee.grace_minutes or 10

    diff = check_in_mins - start_mins
    if diff > grace:
        return "late", diff
    return "present", 0


def check_in(db: Session, payload: CheckInRequest) -> AttendanceLog:
    """Record employee check-in. Prevents duplicate check-in for same date."""
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not employee:
        raise ValueError("Employee not found")

    today_str = payload.date or date.today().isoformat()
    today_date = date.fromisoformat(today_str)   # always a date object for the DB column
    now_str = payload.check_in or datetime.now().strftime("%H:%M:%S")

    # Prevent duplicate check-in
    existing = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.employee_id == payload.employee_id, AttendanceLog.date == today_date)
        .first()
    )
    if existing and existing.check_in:
        raise ValueError("Employee already checked in for today")

    status, late_minutes = _calculate_late_minutes(employee, now_str)

    if existing:
        existing.check_in = now_str
        existing.status = status
        existing.late_minutes = late_minutes
        db.commit()
        db.refresh(existing)
        return existing

    log = AttendanceLog(
        employee_id=payload.employee_id,
        date=today_date,
        check_in=now_str,
        status=status,
        late_minutes=late_minutes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def check_out(db: Session, payload: CheckOutRequest) -> AttendanceLog:
    """Record employee check-out."""
    today_str = payload.date or date.today().isoformat()
    today_date = date.fromisoformat(today_str)
    now_str = payload.check_out or datetime.now().strftime("%H:%M:%S")

    log = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.employee_id == payload.employee_id, AttendanceLog.date == today_date)
        .first()
    )
    if not log:
        raise ValueError("No check-in record found for today")
    if log.check_out:
        raise ValueError("Employee already checked out for today")

    log.check_out = now_str
    db.commit()
    db.refresh(log)
    return log


def get_attendance(
    db: Session,
    employee_id: Optional[int] = None,
    date_str: Optional[str] = None,
    month: Optional[str] = None,
) -> list[AttendanceLog]:
    q = db.query(AttendanceLog)
    if employee_id:
        q = q.filter(AttendanceLog.employee_id == employee_id)
    if date_str:
        # Compare as date object
        q = q.filter(AttendanceLog.date == date.fromisoformat(date_str))
    if month:
        # SQLite stores Date as "YYYY-MM-DD" text — LIKE is safe here
        q = q.filter(AttendanceLog.date.like(f"{month}%"))
    return q.order_by(AttendanceLog.date.desc()).all()


def get_today_status(db: Session) -> list[dict]:
    """Returns all employees with their today's attendance status."""
    from backend.models.employee import Employee as Emp
    today = date.today()   # date object, not string
    employees = db.query(Emp).filter(Emp.is_active.is_(True)).all()
    result = []
    for emp in employees:
        log = (
            db.query(AttendanceLog)
            .filter(AttendanceLog.employee_id == emp.id, AttendanceLog.date == today)
            .first()
        )
        result.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "employment_type": emp.employment_type,
            "job_start_time": emp.job_start_time,
            "check_in": log.check_in if log else None,
            "check_out": log.check_out if log else None,
            "status": log.status if log else "absent",
            "late_minutes": log.late_minutes if log else 0,
        })
    return result
