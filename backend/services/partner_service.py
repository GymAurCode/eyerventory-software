from sqlalchemy.orm import Session

from backend.models.owner_share import OwnerShare
from backend.models.user import User
from backend.services.finance_service import get_finance_summary


def _owner_count(db: Session) -> int:
    return db.query(User).filter(User.role == "owner").count()


def _active_owner_count(db: Session) -> int:
    return db.query(User).filter(User.role == "owner", User.status == "active", User.is_active.is_(True)).count()


def _require_valid_ownership_total(total: float) -> None:
    if abs(total - 100.0) > 1e-6:
        raise ValueError("Ownership must total exactly 100%")


def sync_owner_share_for_new_owner(db: Session, owner_user_id: int, assigned_percentage: float) -> None:
    existing = db.query(OwnerShare).all()
    if not existing:
        db.add(OwnerShare(user_id=owner_user_id, ownership_percentage=100.0))
        return
    if assigned_percentage <= 0 or assigned_percentage >= 100:
        raise ValueError("New owner percentage must be greater than 0 and less than 100")
    remaining = 100.0 - assigned_percentage
    # Scale existing owners proportionally to keep total exactly 100%.
    current_total = sum(item.ownership_percentage for item in existing)
    for item in existing:
        item.ownership_percentage = (item.ownership_percentage / current_total) * remaining
    db.add(OwnerShare(user_id=owner_user_id, ownership_percentage=assigned_percentage))
    _require_valid_ownership_total(remaining + assigned_percentage)


def ensure_owner_share(db: Session, owner_user_id: int) -> None:
    item = db.query(OwnerShare).filter(OwnerShare.user_id == owner_user_id).first()
    if item:
        return
    owners = db.query(User).filter(User.role == "owner").all()
    if not owners:
        return
    equal_split = 100.0 / len(owners)
    for owner in owners:
        share = db.query(OwnerShare).filter(OwnerShare.user_id == owner.id).first()
        if share:
            share.ownership_percentage = equal_split
        else:
            db.add(OwnerShare(user_id=owner.id, ownership_percentage=equal_split))


def remove_owner_share(db: Session, owner_user_id: int) -> None:
    share = db.query(OwnerShare).filter(OwnerShare.user_id == owner_user_id).first()
    if share:
        db.delete(share)
    remaining = db.query(OwnerShare).all()
    if remaining:
        total = sum(item.ownership_percentage for item in remaining)
        for item in remaining:
            item.ownership_percentage = (item.ownership_percentage / total) * 100.0


def update_owner_percentage(db: Session, owner_user_id: int, target_percentage: float) -> None:
    share = db.query(OwnerShare).filter(OwnerShare.user_id == owner_user_id).first()
    if not share:
        raise ValueError("Owner share not found")
    others = db.query(OwnerShare).filter(OwnerShare.user_id != owner_user_id).all()
    if not others and abs(target_percentage - 100.0) > 1e-6:
        raise ValueError("Single owner must have 100%")
    if target_percentage <= 0 or (target_percentage >= 100 and len(others) > 0):
        raise ValueError("Owner percentage must be greater than 0 and less than 100")
    remaining = 100.0 - target_percentage
    others_total = sum(i.ownership_percentage for i in others)
    if others_total <= 0:
        raise ValueError("Cannot assign ownership with invalid remaining shares")
    for item in others:
        item.ownership_percentage = (item.ownership_percentage / others_total) * remaining
    share.ownership_percentage = target_percentage
    _require_valid_ownership_total(target_percentage + remaining)


def list_partner_distribution(db: Session) -> list[dict]:
    summary = get_finance_summary(db)
    owners = (
        db.query(OwnerShare, User)
        .join(User, User.id == OwnerShare.user_id)
        .filter(User.role == "owner")
        .order_by(User.name.asc())
        .all()
    )
    result = []
    for share, user in owners:
        result.append(
            {
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "ownership_percentage": float(share.ownership_percentage),
                "profit_share": float(summary["distributable_profit"] * (share.ownership_percentage / 100)),
            }
        )
    return result


def validate_owner_safety_on_block(db: Session, target_user_id: int, next_status: str) -> None:
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target or target.role != "owner":
        return
    if next_status == "blocked" and target.status != "blocked" and _active_owner_count(db) <= 1:
        raise ValueError("Cannot block all owners")


def validate_owner_safety_on_delete(db: Session, target_user_id: int) -> None:
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target or target.role != "owner":
        return
    if _owner_count(db) <= 1:
        raise ValueError("Cannot delete last owner")
