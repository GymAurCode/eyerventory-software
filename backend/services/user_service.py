from sqlalchemy.orm import Session

from backend.core.security import get_password_hash
from backend.models.user import User
from backend.schemas.user_management import UserCreate, UserUpdate
from backend.services import partner_service


def list_users(db: Session):
    return db.query(User).order_by(User.created_at.desc()).all()


def create_user(db: Session, payload: UserCreate):
    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise ValueError("Email already exists")
    user = User(
        username=payload.email.lower().strip(),
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        status="active",
        is_active=True,
    )
    db.add(user)
    db.flush()
    if user.role == "owner":
        assigned_percentage = payload.ownership_percentage if payload.ownership_percentage is not None else 50.0
        partner_service.sync_owner_share_for_new_owner(db, user.id, assigned_percentage=assigned_percentage)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    updates = payload.model_dump(exclude_none=True)
    if "email" in updates:
        email = updates["email"].lower().strip()
        existing = db.query(User).filter(User.email == email, User.id != user_id).first()
        if existing:
            raise ValueError("Email already exists")
        user.email = email
        user.username = email
    if "name" in updates:
        user.name = updates["name"].strip()
    if "password" in updates:
        user.hashed_password = get_password_hash(updates["password"])
    if "status" in updates:
        partner_service.validate_owner_safety_on_block(db, user_id, updates["status"])
        user.status = updates["status"]
        user.is_active = updates["status"] == "active"
    if "role" in updates and user.role != updates["role"]:
        old_role = user.role
        user.role = updates["role"]
        if old_role == "owner" and user.role != "owner":
            partner_service.validate_owner_safety_on_delete(db, user_id)
            partner_service.remove_owner_share(db, user_id)
        if old_role != "owner" and user.role == "owner":
            partner_service.sync_owner_share_for_new_owner(db, user_id, assigned_percentage=50.0)

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    if user.role == "owner":
        partner_service.validate_owner_safety_on_delete(db, user_id)
        partner_service.remove_owner_share(db, user_id)
    db.delete(user)
    db.commit()
    return True
