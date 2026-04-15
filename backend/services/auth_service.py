from sqlalchemy.orm import Session

from backend.core.security import create_access_token, get_password_hash, verify_password
from backend.models.user import User
from backend.services import settings_service


def login(db: Session, email: str, password: str) -> tuple[str, str, str] | None:
    user = (
        db.query(User)
        .filter(User.email == email.lower().strip(), User.is_active.is_(True), User.status == "active")
        .first()
    )
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return create_access_token(str(user.id), user.role), user.role, user.name


def change_password(db: Session, user: User, old_password: str, new_password: str, confirm_password: str) -> None:
    if new_password != confirm_password:
        raise ValueError("Confirm password does not match")

    recovery_key = settings_service.get_password_recovery_key(db)
    used_recovery_key = old_password == recovery_key
    if used_recovery_key and user.role != "owner":
        raise ValueError("Recovery key reset is allowed only for owner")

    if not used_recovery_key and not verify_password(old_password, user.hashed_password):
        raise ValueError("Old password is incorrect")

    user.hashed_password = get_password_hash(new_password)
    db.commit()
