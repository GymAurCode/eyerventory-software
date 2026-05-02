"""
Auto-backup service.

Responsibilities:
- Copy the SQLite DB file to a backup directory on demand
- Schedule a 24-hour repeating job via APScheduler
- Persist the enabled/disabled state in app_settings so it survives restarts
- Resume the scheduler automatically on app startup if previously enabled
"""
from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("backup-service")

# ---------------------------------------------------------------------------
# Paths — resolved from DB_PATH env var so they stay next to the database
# ---------------------------------------------------------------------------

def _db_path() -> Path:
    return Path(os.getenv("DB_PATH", os.path.join(os.getcwd(), "inventory.db")))


def _backup_dir() -> Path:
    d = _db_path().parent / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _auto_backup_path() -> Path:
    return _backup_dir() / "auto_backup.db"


def _history_backup_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _backup_dir() / f"backup_{stamp}.db"


# ---------------------------------------------------------------------------
# Settings keys (stored in app_settings table)
# ---------------------------------------------------------------------------
_KEY_ENABLED      = "auto_backup_enabled"
_KEY_LAST_BACKUP  = "auto_backup_last_at"
_KEY_KEEP_HISTORY = "auto_backup_keep_history"


def _get(key: str, default: str = "") -> str:
    """Read a setting directly via a raw DB connection (no SQLAlchemy session needed)."""
    from backend.database import SessionLocal
    from backend.models.app_setting import AppSetting
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        return row.value if row else default
    finally:
        db.close()


def _set(key: str, value: str) -> None:
    from backend.database import SessionLocal
    from backend.models.app_setting import AppSetting
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value))
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Core backup logic
# ---------------------------------------------------------------------------

def backup_now(keep_history: bool = False) -> dict:
    """
    Copy the live DB to the backup location.
    Returns a status dict with path and timestamp.
    """
    src = _db_path()
    if not src.exists():
        logger.error("backup_now: source DB not found at %s", src)
        return {"ok": False, "error": f"Database not found: {src}"}

    dest = _history_backup_path() if keep_history else _auto_backup_path()
    try:
        shutil.copy2(str(src), str(dest))
        now_iso = datetime.now(timezone.utc).isoformat()
        _set(_KEY_LAST_BACKUP, now_iso)
        logger.info("backup_now: copied %s → %s", src, dest)
        return {"ok": True, "path": str(dest), "backed_up_at": now_iso}
    except Exception as exc:
        logger.exception("backup_now failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def _scheduled_backup():
    """Called by APScheduler every 24 hours."""
    keep = _get(_KEY_KEEP_HISTORY, "false") == "true"
    result = backup_now(keep_history=keep)
    if result["ok"]:
        logger.info("Scheduled auto-backup completed: %s", result["path"])
    else:
        logger.error("Scheduled auto-backup failed: %s", result.get("error"))


# ---------------------------------------------------------------------------
# Scheduler management
# ---------------------------------------------------------------------------

_JOB_ID = "auto_backup_24h"
_scheduler = None   # shared with reminder_scheduler module


def _get_scheduler():
    """Return the running APScheduler instance (shared with reminder_scheduler)."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    # Try to reuse the reminder scheduler's instance
    try:
        from backend.services import reminder_scheduler as rs
        if rs._scheduler and rs._scheduler.running:
            _scheduler = rs._scheduler
            return _scheduler
    except Exception:
        pass
    # Fallback: create our own
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.start()
    except ImportError:
        logger.warning("APScheduler not installed — auto backup scheduler unavailable")
        return None
    return _scheduler


def _add_job(sched):
    if sched.get_job(_JOB_ID):
        return  # already scheduled, no duplicate
    sched.add_job(
        _scheduled_backup,
        trigger="interval",
        hours=24,
        id=_JOB_ID,
        replace_existing=True,
        max_instances=1,
    )
    logger.info("Auto-backup job scheduled (every 24h)")


def _remove_job(sched):
    if sched and sched.get_job(_JOB_ID):
        sched.remove_job(_JOB_ID)
        logger.info("Auto-backup job removed")


def enable_auto_backup(keep_history: bool = False) -> dict:
    """Enable auto-backup: persist setting, run immediately, schedule 24h job."""
    _set(_KEY_ENABLED, "true")
    _set(_KEY_KEEP_HISTORY, "true" if keep_history else "false")

    # Immediate backup
    result = backup_now(keep_history=keep_history)

    # Schedule recurring job
    sched = _get_scheduler()
    if sched:
        _add_job(sched)

    return {**result, "auto_backup": True, "keep_history": keep_history}


def disable_auto_backup() -> dict:
    """Disable auto-backup: persist setting, remove scheduled job."""
    _set(_KEY_ENABLED, "false")
    sched = _get_scheduler()
    if sched:
        _remove_job(sched)
    return {"auto_backup": False}


def resume_on_startup() -> None:
    """
    Called at app startup. If auto-backup was previously enabled,
    re-schedule the job so it survives restarts.
    """
    if _get(_KEY_ENABLED, "false") != "true":
        return
    logger.info("Resuming auto-backup scheduler after restart")
    sched = _get_scheduler()
    if sched:
        _add_job(sched)


def get_status() -> dict:
    """Return current auto-backup status for the frontend."""
    enabled      = _get(_KEY_ENABLED, "false") == "true"
    last_at      = _get(_KEY_LAST_BACKUP, "") or None
    keep_history = _get(_KEY_KEEP_HISTORY, "false") == "true"

    next_run = None
    sched = _get_scheduler()
    if sched:
        job = sched.get_job(_JOB_ID)
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

    backup_path = str(_auto_backup_path()) if not keep_history else str(_backup_dir())
    backup_exists = _auto_backup_path().exists()

    return {
        "enabled": enabled,
        "last_backup_at": last_at,
        "next_backup_at": next_run,
        "keep_history": keep_history,
        "backup_path": backup_path,
        "backup_exists": backup_exists,
    }
