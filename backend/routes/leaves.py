from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import get_current_user, require_roles
from backend.schemas.leave_schema import LeaveApprove, LeaveCreate
from backend.services import leave_service

router = APIRouter(prefix="/leaves", tags=["leaves"])


def _serialize(leave) -> dict:
    """Convert a Leave ORM object to a JSON-safe dict."""
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "employee_name": leave.employee.name if leave.employee else None,
        "type": leave.type,
        "start_date": leave.start_date.isoformat() if leave.start_date else None,
        "end_date": leave.end_date.isoformat() if leave.end_date else None,
        "reason": leave.reason,
        "status": leave.status,
        "approved_by": leave.approved_by,
        "created_at": leave.created_at.isoformat() if leave.created_at else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_leave(
    payload: LeaveCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr", "staff")),
):
    try:
        leave = leave_service.create_leave(db, payload)
        return _serialize(leave)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{leave_id}/approve")
def approve_leave(
    leave_id: int,
    payload: LeaveApprove,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    try:
        leave = leave_service.approve_leave(db, leave_id, payload, approver_id=user.id)
        return _serialize(leave)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("")
def list_leaves(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    leaves = leave_service.list_leaves(db, employee_id=employee_id, status=status)
    return [_serialize(l) for l in leaves]
