from datetime import datetime

from sqlalchemy.orm import Session

from backend.models.activity_log import ActivityLog


def time_ago(dt: datetime) -> str:
    diff = datetime.now() - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return f"{seconds} seconds ago"
    elif seconds < 3600:
        return f"{seconds // 60} minutes ago"
    elif seconds < 86400:
        return f"{seconds // 3600} hours ago"
    else:
        return f"{seconds // 86400} days ago"


def log_activity(
    db: Session,
    action_type: str,
    description: str,
    reference_id: int | None = None,
    reference_type: str | None = None,
    amount: float | None = None,
    created_by: str = "system",
) -> ActivityLog:
    activity = ActivityLog(
        action_type=action_type,
        description=description,
        reference_id=reference_id,
        reference_type=reference_type,
        amount=amount,
        created_by=created_by,
        created_at=datetime.now(),
    )
    db.add(activity)
    db.commit()
    return activity
