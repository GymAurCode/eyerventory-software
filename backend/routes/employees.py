from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate
from backend.services import employee_service

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeRead])
def list_employees(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    return employee_service.list_employees(db, active_only=active_only)


@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    try:
        return employee_service.create_employee(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "hr")),
):
    emp = employee_service.update_employee(db, employee_id, payload)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return emp
