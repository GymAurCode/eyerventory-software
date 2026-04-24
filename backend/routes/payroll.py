from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.payroll_schema import PayrollGenerate
from backend.services import payroll_service

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_payroll(
    payload: PayrollGenerate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    """Generate payroll — calculation only, no financial impact."""
    try:
        return payroll_service.generate_payroll(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("")
def list_payrolls(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    return payroll_service.get_payrolls(db, employee_id=employee_id)
