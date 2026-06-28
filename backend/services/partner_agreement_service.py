from datetime import date, datetime

from sqlalchemy.orm import Session

from backend.models.partner_agreement import PartnerAgreement


def create_agreement(db: Session, payload: dict) -> PartnerAgreement:
    _validate_dates(payload)
    agreement = PartnerAgreement(**payload)
    db.add(agreement)
    db.flush()
    return agreement


def update_agreement(db: Session, agreement_id: int, payload: dict) -> PartnerAgreement:
    agreement = db.query(PartnerAgreement).filter(PartnerAgreement.id == agreement_id).first()
    if not agreement:
        raise ValueError("Agreement not found")
    for key, value in payload.items():
        if value is not None:
            setattr(agreement, key, value)
    agreement.updated_at = datetime.utcnow()
    _validate_dates(agreement.__dict__)
    db.flush()
    return agreement


def _validate_dates(data: dict) -> None:
    start = data.get("agreement_start_date")
    end = data.get("agreement_end_date")
    if start and end and end < start:
        raise ValueError("End date cannot be before start date")


def get_agreements_for_user(db: Session, user_id: int) -> list[PartnerAgreement]:
    return (
        db.query(PartnerAgreement)
        .filter(PartnerAgreement.user_id == user_id)
        .order_by(PartnerAgreement.agreement_start_date.desc())
        .all()
    )


def get_active_agreements(db: Session) -> list[PartnerAgreement]:
    return (
        db.query(PartnerAgreement)
        .filter(PartnerAgreement.status == "active")
        .all()
    )


def get_agreements_active_in_month(db: Session, year: int, month: int) -> list[PartnerAgreement]:
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)
    return (
        db.query(PartnerAgreement)
        .filter(
            PartnerAgreement.agreement_start_date < month_end,
            (PartnerAgreement.agreement_end_date.is_(None) | (PartnerAgreement.agreement_end_date >= month_start)),
            PartnerAgreement.status.in_(["active", "ended"]),
        )
        .all()
    )


def get_agreement_by_id(db: Session, agreement_id: int) -> PartnerAgreement | None:
    return db.query(PartnerAgreement).filter(PartnerAgreement.id == agreement_id).first()


def get_current_agreement_for_user(db: Session, user_id: int) -> PartnerAgreement | None:
    return (
        db.query(PartnerAgreement)
        .filter(
            PartnerAgreement.user_id == user_id,
            PartnerAgreement.status == "active",
        )
        .first()
    )
