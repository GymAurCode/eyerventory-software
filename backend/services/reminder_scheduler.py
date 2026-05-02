"""
APScheduler-based reminder scheduler.
Runs a background job every 30 seconds to check for due reminders
and push WebSocket notifications to connected users.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("reminder-scheduler")

_scheduler = None
_loop: asyncio.AbstractEventLoop | None = None


def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None or _loop.is_closed():
        try:
            _loop = asyncio.get_event_loop()
        except RuntimeError:
            _loop = asyncio.new_event_loop()
            asyncio.set_event_loop(_loop)
    return _loop


def _fire_due_reminders():
    """Synchronous job called by APScheduler. Bridges into async via run_coroutine_threadsafe."""
    try:
        from backend.database import SessionLocal
        from backend.services import reminder_service
        from backend.services.ws_manager import manager

        db = SessionLocal()
        try:
            due = reminder_service.get_due_reminders(db)
            if not due:
                return

            logger.info("Scheduler: %d due reminder(s) found", len(due))

            for reminder in due:
                # Write delivered log
                reminder_service.write_delivered_log(db, reminder.id)

                payload = {
                    "type": "reminder_due",
                    "reminder": {
                        "id": reminder.id,
                        "title": reminder.title,
                        "description": reminder.description,
                        "remind_at": reminder.remind_at.isoformat(),
                        "priority": reminder.priority,
                        "repeat": reminder.repeat,
                        "status": reminder.status,
                        "reminder_before": reminder.reminder_before,
                    },
                }

                loop = _get_loop()
                if loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        manager.send_to_user(reminder.user_id, payload), loop
                    )
                else:
                    loop.run_until_complete(manager.send_to_user(reminder.user_id, payload))

            # Mark missed reminders (overdue > 1 hour with no log)
            missed = reminder_service.mark_missed(db)
            if missed:
                logger.info("Scheduler: marked %d reminder(s) as missed", missed)

        finally:
            db.close()

    except Exception as exc:
        logger.exception("Scheduler job failed: %s", exc)


def start_scheduler():
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        if _scheduler and _scheduler.running:
            logger.info("Scheduler already running")
            return

        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.add_job(
            _fire_due_reminders,
            trigger="interval",
            seconds=30,
            id="reminder_check",
            replace_existing=True,
            max_instances=1,
        )
        _scheduler.start()
        logger.info("Reminder scheduler started (30s interval)")
    except ImportError:
        logger.warning("APScheduler not installed — reminder scheduler disabled. Run: pip install apscheduler")
    except Exception as exc:
        logger.exception("Failed to start scheduler: %s", exc)


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Reminder scheduler stopped")
