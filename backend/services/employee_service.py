from sqlalchemy.orm import Session

from backend.models.employee import Employee
from backend.schemas.employee import EmployeeCreate, EmployeeUpdate


def create_employee(db: Session, payload: EmployeeCreate) -> Employee:
    """Create a new employee record."""
    if payload.employment_type == "monthly" and not payload.salary:
        raise ValueError("Monthly employees require a salary")
    if payload.employment_type == "daily" and not payload.daily_wage:
        raise ValueError("Daily employees require a daily_wage")

    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


def list_employees(db: Session, active_only: bool = False) -> list[Employee]:
    q = db.query(Employee)
    if active_only:
        q = q.filter(Employee.is_active.is_(True))
    return q.order_by(Employee.id.desc()).all()


def get_employee(db: Session, employee_id: int) -> Employee | None:
    return db.query(Employee).filter(Employee.id == employee_id).first()


def update_employee(db: Session, employee_id: int, payload: EmployeeUpdate) -> Employee | None:
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)
    db.commit()
    db.refresh(emp)
    return emp
