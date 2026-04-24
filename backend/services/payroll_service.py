from typing import Optional

from sqlalchemy.orm import Session

from backend.models.attendance_log import AttendanceLog
from backend.models.employee import Employee
from backend.models.hr_payment import HRPayment
from backend.models.payroll import Payroll
from backend.schemas.payroll_schema import PayrollGenerate
from backend.services.leave_service import get_unpaid_leave_days


def _sum_payments(db: Session, payroll_id: int) -> float:
    """Sum all active (non-reversed) payments linked to a payroll."""
    payments = (
        db.query(HRPayment)
        .filter(HRPayment.payroll_id == payroll_id, HRPayment.is_reversed == 0)
        .all()
    )
    return sum(p.amount for p in payments)


def generate_payroll(db: Session, payload: PayrollGenerate) -> Payroll:
    """
    Calculate payroll for an employee for a given month.
    PURE CALCULATION ONLY — no financial impact, no journal entries.
    """
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not employee:
        raise ValueError("Employee not found")

    existing = (
        db.query(Payroll)
        .filter(Payroll.employee_id == payload.employee_id, Payroll.month == payload.month)
        .first()
    )
    if existing:
        raise ValueError(f"Payroll for {payload.month} already exists")

    logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.employee_id == payload.employee_id,
            AttendanceLog.date.like(f"{payload.month}%"),
        )
        .all()
    )

    present_days = sum(1 for l in logs if l.status in ("present", "late"))
    late_days = sum(1 for l in logs if l.status == "late")
    absent_days = payload.total_working_days - present_days
    unpaid_leave_days = get_unpaid_leave_days(db, payload.employee_id, payload.month)

    if employee.employment_type == "monthly":
        base_salary = employee.salary or 0.0
        per_day = base_salary / payload.total_working_days if payload.total_working_days else 0
        deductions = absent_days * per_day
        late_penalty = late_days * (per_day * 0.2)
        unpaid_deduction = unpaid_leave_days * per_day
        total_deductions = deductions + late_penalty + unpaid_deduction
        net_salary = base_salary - total_deductions + payload.bonus
    else:
        base_salary = employee.daily_wage or 0.0
        total_deductions = 0.0
        net_salary = present_days * base_salary + payload.bonus

    payroll = Payroll(
        employee_id=payload.employee_id,
        month=payload.month,
        base_salary=base_salary,
        total_working_days=payload.total_working_days,
        present_days=present_days,
        late_days=late_days,
        absent_days=absent_days,
        deductions=round(total_deductions, 2),
        bonus=payload.bonus,
        net_salary=round(max(net_salary, 0), 2),
        status="unpaid",
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return payroll


def get_payrolls(db: Session, employee_id: Optional[int] = None) -> list[dict]:
    q = db.query(Payroll)
    if employee_id:
        q = q.filter(Payroll.employee_id == employee_id)
    rows = q.order_by(Payroll.id.desc()).all()

    result = []
    for p in rows:
        paid = _sum_payments(db, p.id)
        # Auto-derive status from payments — no manual "mark paid" needed
        if paid <= 0:
            derived_status = "unpaid"
        elif paid < p.net_salary:
            derived_status = "partial"
        else:
            derived_status = "paid"

        result.append({
            **{c.name: getattr(p, c.name) for c in Payroll.__table__.columns},
            "employee_name": p.employee.name if p.employee else None,
            "paid_amount": round(paid, 2),
            "remaining": round(max(p.net_salary - paid, 0), 2),
            "derived_status": derived_status,
        })
    return result
