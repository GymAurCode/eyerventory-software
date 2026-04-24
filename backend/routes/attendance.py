from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.attendance import CheckInRequest, CheckOutRequest
from backend.services import attendance_service

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _serialize(log) -> dict:
    """Convert an AttendanceLog ORM object to a JSON-safe dict."""
    return {
        "id": log.id,
        "employee_id": log.employee_id,
        "employee_name": log.employee.name if log.employee else None,
        "date": log.date.isoformat() if log.date else None,
        "check_in": log.check_in,
        "check_out": log.check_out,
        "status": log.status,
        "late_minutes": log.late_minutes,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@router.post("/check-in", status_code=status.HTTP_201_CREATED)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr", "staff")),
):
    try:
        log = attendance_service.check_in(db, payload)
        db.expire(log)
        db.refresh(log)
        return _serialize(log)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/check-out")
def check_out(
    payload: CheckOutRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr", "staff")),
):
    try:
        log = attendance_service.check_out(db, payload)
        db.expire(log)
        db.refresh(log)
        return _serialize(log)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("")
def get_attendance(
    employee_id: Optional[int] = None,
    date: Optional[str] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    logs = attendance_service.get_attendance(db, employee_id=employee_id, date_str=date, month=month)
    return [_serialize(log) for log in logs]


@router.get("/today")
def today_status(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    return attendance_service.get_today_status(db)
