from __future__ import annotations

import logging
from datetime import timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.reminder import (
    BulkActionPayload,
    ReminderCreate,
    ReminderRead,
    ReminderUpdate,
    SnoozePayload,
    TemplateApply,
    TemplateCreate,
    TemplateRead,
)
from backend.services import reminder_service
from backend.services.ws_manager import manager
from backend.core.security import decode_token

router = APIRouter(prefix="/reminders", tags=["reminders"])
logger = logging.getLogger("reminders-routes")


# ---------------------------------------------------------------------------
# WebSocket endpoint — registered here but also mounted directly on app
# in main.py to bypass CORS middleware
# ---------------------------------------------------------------------------

async def reminder_ws_handler(websocket: WebSocket, token: str = Query(...)):
    """
    Connect with ?token=<jwt>. Pushes reminder_due events in real-time.
    Registered both on the router and directly on app (main.py) to bypass CORS.
    """
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub", 0))
        if not user_id:
            raise ValueError("invalid sub")
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user_id)
    logger.info("WS reminder connected user_id=%s", user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info("WS reminder disconnected user_id=%s", user_id)
    except Exception as exc:
        logger.warning("WS reminder error user_id=%s: %s", user_id, exc)
        manager.disconnect(websocket, user_id)


# Also attach to router so it shows in OpenAPI docs
router.add_api_websocket_route("/ws", reminder_ws_handler)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    stats = reminder_service.get_dashboard_stats(db, user.id)
    return {
        "upcoming_24h": [_serialize(r) for r in stats["upcoming_24h"]],
        "overdue": [_serialize(r) for r in stats["overdue"]],
        "today_total": stats["today_total"],
        "today_completed": stats["today_completed"],
        "today_pending": stats["today_pending"],
    }


# ---------------------------------------------------------------------------
# Reminders CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ReminderRead])
def list_reminders(
    filter_by: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="remind_at"),
    sort_dir: str = Query(default="asc"),
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    return reminder_service.list_reminders(db, user.id, filter_by, search, sort_by, sort_dir)


@router.post("", response_model=ReminderRead, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    return reminder_service.create_reminder(db, user.id, payload)


@router.get("/{reminder_id}", response_model=ReminderRead)
def get_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    r = reminder_service.get_reminder(db, reminder_id, user.id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return r


@router.put("/{reminder_id}", response_model=ReminderRead)
def update_reminder(
    reminder_id: int,
    payload: ReminderUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    r = reminder_service.update_reminder(db, reminder_id, user.id, payload)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return r


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    if not reminder_service.delete_reminder(db, reminder_id, user.id):
        raise HTTPException(status_code=404, detail="Reminder not found")


@router.post("/{reminder_id}/snooze", response_model=ReminderRead)
def snooze_reminder(
    reminder_id: int,
    payload: SnoozePayload,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    r = reminder_service.snooze_reminder(db, reminder_id, user.id, payload.minutes)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return r


@router.post("/{reminder_id}/complete", response_model=ReminderRead)
def complete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    r = reminder_service.complete_reminder(db, reminder_id, user.id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return r


@router.post("/bulk", status_code=status.HTTP_200_OK)
def bulk_action(
    payload: BulkActionPayload,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    return reminder_service.bulk_action(db, user.id, payload)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@router.get("/templates/list", response_model=list[TemplateRead])
def list_templates(
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    return reminder_service.list_templates(db, user.id)


@router.post("/templates", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    return reminder_service.create_template(db, user.id, payload)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    if not reminder_service.delete_template(db, template_id, user.id):
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/{template_id}/apply", response_model=ReminderRead, status_code=status.HTTP_201_CREATED)
def apply_template(
    template_id: int,
    payload: TemplateApply,
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    r = reminder_service.apply_template(db, template_id, user.id, payload.remind_at, payload.variables)
    if not r:
        raise HTTPException(status_code=404, detail="Template not found")
    return r


# ---------------------------------------------------------------------------
# Notification Logs
# ---------------------------------------------------------------------------

@router.get("/notifications/logs")
def list_logs(
    reminder_id: Optional[int] = Query(default=None),
    log_status: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    return reminder_service.list_logs(db, user.id, reminder_id, log_status, search)


@router.get("/notifications/logs/export")
def export_logs(
    db: Session = Depends(get_db),
    user=Depends(require_roles("owner", "staff")),
):
    csv_data = reminder_service.export_logs_csv(db, user.id)
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=notification_logs.csv"},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize(r) -> dict:
    def _iso(dt) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()

    return {
        "id": r.id,
        "user_id": r.user_id,
        "title": r.title,
        "description": r.description,
        "remind_at": _iso(r.remind_at),
        "priority": r.priority,
        "repeat": r.repeat,
        "status": r.status,
        "reminder_before": r.reminder_before,
        "template_id": r.template_id,
        "created_at": _iso(r.created_at),
        "updated_at": _iso(r.updated_at),
    }
