from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from backend.models.reminder import NotificationLog, Reminder, ReminderTemplate
from backend.schemas.reminder import (
    BulkActionPayload,
    ReminderCreate,
    ReminderUpdate,
    TemplateCreate,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    """Ensure a datetime is UTC-aware. Naive = assume UTC (SQLite returns naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _apply_variables(text: str, variables: dict[str, str]) -> str:
    """Replace {{key}} placeholders with values from variables dict."""
    def replacer(match):
        key = match.group(1).strip()
        return variables.get(key, match.group(0))
    return re.sub(r"\{\{([^}]+)\}\}", replacer, text or "")


def _next_repeat_time(remind_at: datetime, repeat: str) -> Optional[datetime]:
    if repeat == "daily":
        return remind_at + timedelta(days=1)
    if repeat == "weekly":
        return remind_at + timedelta(weeks=1)
    if repeat == "monthly":
        # Advance by one calendar month, clamping to last day of month
        month = remind_at.month + 1
        year = remind_at.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        day = min(remind_at.day, last_day)
        return remind_at.replace(year=year, month=month, day=day)
    return None


# ---------------------------------------------------------------------------
# Reminder CRUD
# ---------------------------------------------------------------------------

def list_reminders(
    db: Session,
    user_id: int,
    filter_by: Optional[str] = None,   # today | upcoming | completed | overdue
    search: Optional[str] = None,
    sort_by: str = "remind_at",
    sort_dir: str = "asc",
) -> list[Reminder]:
    q = db.query(Reminder).filter(Reminder.user_id == user_id)

    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    if filter_by == "today":
        q = q.filter(Reminder.remind_at >= today_start, Reminder.remind_at < today_end)
    elif filter_by == "upcoming":
        q = q.filter(Reminder.remind_at > now, Reminder.status == "pending")
    elif filter_by == "completed":
        q = q.filter(Reminder.status == "completed")
    elif filter_by == "overdue":
        q = q.filter(Reminder.remind_at < now, Reminder.status == "pending")

    if search:
        term = f"%{search}%"
        q = q.filter(or_(Reminder.title.ilike(term), Reminder.description.ilike(term)))

    col = getattr(Reminder, sort_by, Reminder.remind_at)
    q = q.order_by(col.asc() if sort_dir == "asc" else col.desc())
    return q.all()


def get_reminder(db: Session, reminder_id: int, user_id: int) -> Optional[Reminder]:
    return db.query(Reminder).filter(
        Reminder.id == reminder_id, Reminder.user_id == user_id
    ).first()


def create_reminder(db: Session, user_id: int, payload: ReminderCreate) -> Reminder:
    reminder = Reminder(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        remind_at=payload.remind_at,
        priority=payload.priority,
        repeat=payload.repeat,
        status="pending",
        reminder_before=payload.reminder_before,
        template_id=payload.template_id,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


def update_reminder(db: Session, reminder_id: int, user_id: int, payload: ReminderUpdate) -> Optional[Reminder]:
    reminder = get_reminder(db, reminder_id, user_id)
    if not reminder:
        return None
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return reminder


def delete_reminder(db: Session, reminder_id: int, user_id: int) -> bool:
    reminder = get_reminder(db, reminder_id, user_id)
    if not reminder:
        return False
    db.delete(reminder)
    db.commit()
    return True


def snooze_reminder(db: Session, reminder_id: int, user_id: int, minutes: int) -> Optional[Reminder]:
    reminder = get_reminder(db, reminder_id, user_id)
    if not reminder:
        return None
    reminder.remind_at = _now() + timedelta(minutes=minutes)
    reminder.status = "snoozed"
    db.commit()
    db.refresh(reminder)
    # Log the snooze action
    _write_log(db, reminder_id, "delivered", "snoozed", minutes)
    return reminder


def complete_reminder(db: Session, reminder_id: int, user_id: int) -> Optional[Reminder]:
    reminder = get_reminder(db, reminder_id, user_id)
    if not reminder:
        return None

    # Log the completion before mutating the row
    _write_log(db, reminder_id, "delivered", "completed")

    next_time = _next_repeat_time(reminder.remind_at, reminder.repeat)
    if next_time:
        # Repeating: update the SAME row to the next occurrence — no new row created
        reminder.remind_at = next_time
        reminder.status = "pending"
    else:
        # Non-repeating: just mark done
        reminder.status = "completed"

    db.commit()
    db.refresh(reminder)
    return reminder


def bulk_action(db: Session, user_id: int, payload: BulkActionPayload) -> dict:
    reminders = db.query(Reminder).filter(
        Reminder.id.in_(payload.ids), Reminder.user_id == user_id
    ).all()
    affected = len(reminders)
    if payload.action == "complete":
        for r in reminders:
            _write_log(db, r.id, "delivered", "completed")
            next_time = _next_repeat_time(r.remind_at, r.repeat)
            if next_time:
                r.remind_at = next_time
                r.status = "pending"
            else:
                r.status = "completed"
    elif payload.action == "delete":
        for r in reminders:
            db.delete(r)
    db.commit()
    return {"affected": affected}


def get_dashboard_stats(db: Session, user_id: int) -> dict:
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    next_24h = now + timedelta(hours=24)

    upcoming = db.query(Reminder).filter(
        Reminder.user_id == user_id,
        Reminder.remind_at.between(now, next_24h),
        Reminder.status == "pending",
    ).order_by(Reminder.remind_at).all()

    overdue = db.query(Reminder).filter(
        Reminder.user_id == user_id,
        Reminder.remind_at < now,
        Reminder.status == "pending",
    ).order_by(Reminder.remind_at.desc()).all()

    today_total = db.query(Reminder).filter(
        Reminder.user_id == user_id,
        Reminder.remind_at >= today_start,
        Reminder.remind_at < today_end,
    ).count()

    today_completed = db.query(Reminder).filter(
        Reminder.user_id == user_id,
        Reminder.remind_at >= today_start,
        Reminder.remind_at < today_end,
        Reminder.status == "completed",
    ).count()

    return {
        "upcoming_24h": upcoming,
        "overdue": overdue,
        "today_total": today_total,
        "today_completed": today_completed,
        "today_pending": today_total - today_completed,
    }


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

def list_templates(db: Session, user_id: int) -> list[ReminderTemplate]:
    return db.query(ReminderTemplate).filter(ReminderTemplate.user_id == user_id).all()


def create_template(db: Session, user_id: int, payload: TemplateCreate) -> ReminderTemplate:
    tpl = ReminderTemplate(
        user_id=user_id,
        name=payload.name,
        title_template=payload.title_template,
        description_template=payload.description_template,
        priority=payload.priority,
        repeat=payload.repeat,
        reminder_before=payload.reminder_before,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


def delete_template(db: Session, template_id: int, user_id: int) -> bool:
    tpl = db.query(ReminderTemplate).filter(
        ReminderTemplate.id == template_id, ReminderTemplate.user_id == user_id
    ).first()
    if not tpl:
        return False
    db.delete(tpl)
    db.commit()
    return True


def apply_template(
    db: Session, template_id: int, user_id: int, remind_at: datetime, variables: dict
) -> Optional[Reminder]:
    tpl = db.query(ReminderTemplate).filter(
        ReminderTemplate.id == template_id, ReminderTemplate.user_id == user_id
    ).first()
    if not tpl:
        return None
    reminder = Reminder(
        user_id=user_id,
        title=_apply_variables(tpl.title_template, variables),
        description=_apply_variables(tpl.description_template or "", variables),
        remind_at=remind_at,
        priority=tpl.priority,
        repeat=tpl.repeat,
        status="pending",
        reminder_before=tpl.reminder_before,
        template_id=template_id,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


# ---------------------------------------------------------------------------
# Notification Logs
# ---------------------------------------------------------------------------

def _write_log(
    db: Session,
    reminder_id: int,
    status: str,
    user_action: Optional[str] = None,
    snooze_minutes: Optional[int] = None,
) -> NotificationLog:
    log = NotificationLog(
        reminder_id=reminder_id,
        triggered_at=_now(),
        status=status,
        user_action=user_action,
        snooze_minutes=snooze_minutes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def list_logs(
    db: Session,
    user_id: int,
    reminder_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    """Join logs with reminders to filter by user_id."""
    q = (
        db.query(NotificationLog, Reminder.title, Reminder.priority)
        .join(Reminder, NotificationLog.reminder_id == Reminder.id)
        .filter(Reminder.user_id == user_id)
    )
    if reminder_id:
        q = q.filter(NotificationLog.reminder_id == reminder_id)
    if status:
        q = q.filter(NotificationLog.status == status)
    if search:
        q = q.filter(Reminder.title.ilike(f"%{search}%"))
    rows = q.order_by(NotificationLog.triggered_at.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "reminder_id": log.reminder_id,
            "reminder_title": title,
            "reminder_priority": priority,
            "triggered_at": _to_utc(log.triggered_at).isoformat(),
            "status": log.status,
            "user_action": log.user_action,
            "snooze_minutes": log.snooze_minutes,
            "created_at": _to_utc(log.created_at).isoformat(),
        }
        for log, title, priority in rows
    ]


def export_logs_csv(db: Session, user_id: int) -> str:
    logs = list_logs(db, user_id, limit=10000)
    lines = ["id,reminder_id,reminder_title,triggered_at,status,user_action,snooze_minutes"]
    for log in logs:
        lines.append(
            f"{log['id']},{log['reminder_id']},\"{log['reminder_title']}\","
            f"{log['triggered_at']},{log['status']},"
            f"{log['user_action'] or ''},{log['snooze_minutes'] or ''}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Scheduler helpers (called by the scheduler service)
# ---------------------------------------------------------------------------

def get_due_reminders(db: Session) -> list[Reminder]:
    """Return pending reminders whose fire time (remind_at - reminder_before) has passed."""
    now = _now()
    all_pending = db.query(Reminder).filter(Reminder.status == "pending").all()
    due = []
    for r in all_pending:
        fire_at = r.remind_at - timedelta(minutes=r.reminder_before)
        if fire_at <= now:
            due.append(r)
    return due


def mark_missed(db: Session) -> int:
    """Mark reminders that are overdue by more than 1 hour as missed in logs."""
    cutoff = _now() - timedelta(hours=1)
    overdue = db.query(Reminder).filter(
        Reminder.status == "pending",
        Reminder.remind_at < cutoff,
    ).all()
    count = 0
    for r in overdue:
        existing = db.query(NotificationLog).filter(
            NotificationLog.reminder_id == r.id,
            NotificationLog.status == "missed",
        ).first()
        if not existing:
            _write_log(db, r.id, "missed")
            count += 1
    return count


def write_delivered_log(db: Session, reminder_id: int) -> NotificationLog:
    return _write_log(db, reminder_id, "delivered")
