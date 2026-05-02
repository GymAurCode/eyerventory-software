from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator, field_serializer


VALID_PRIORITY = {"low", "medium", "high"}
VALID_REPEAT = {"none", "daily", "weekly", "monthly"}
VALID_STATUS = {"pending", "completed", "snoozed"}


def _to_utc(dt: datetime) -> datetime:
    """Ensure datetime is UTC. Naive datetimes are assumed to already be UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _utc_serializer(dt: datetime | None) -> str | None:
    """Always serialize as UTC ISO string with explicit +00:00 offset."""
    if dt is None:
        return None
    return _to_utc(dt).isoformat()


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    remind_at: datetime
    priority: str = "medium"
    repeat: str = "none"
    reminder_before: int = Field(default=0, ge=0, le=10080)
    template_id: Optional[int] = None

    @field_validator("remind_at", mode="after")
    @classmethod
    def normalize_utc(cls, v: datetime) -> datetime:
        return _to_utc(v)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v not in VALID_PRIORITY:
            raise ValueError(f"priority must be one of {VALID_PRIORITY}")
        return v

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v):
        if v not in VALID_REPEAT:
            raise ValueError(f"repeat must be one of {VALID_REPEAT}")
        return v


class ReminderUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    remind_at: Optional[datetime] = None
    priority: Optional[str] = None
    repeat: Optional[str] = None
    status: Optional[str] = None
    reminder_before: Optional[int] = Field(default=None, ge=0, le=10080)

    @field_validator("remind_at", mode="after")
    @classmethod
    def normalize_utc(cls, v: datetime | None) -> datetime | None:
        return _to_utc(v) if v is not None else None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in VALID_PRIORITY:
            raise ValueError(f"priority must be one of {VALID_PRIORITY}")
        return v

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v):
        if v is not None and v not in VALID_REPEAT:
            raise ValueError(f"repeat must be one of {VALID_REPEAT}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in VALID_STATUS:
            raise ValueError(f"status must be one of {VALID_STATUS}")
        return v


class ReminderRead(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    remind_at: datetime
    priority: str
    repeat: str
    status: str
    reminder_before: int
    template_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    # Always emit datetimes as UTC ISO strings so the frontend's
    # new Date(str) parses them correctly regardless of server timezone.
    @field_serializer("remind_at", "created_at", "updated_at")
    def serialize_dt(self, dt: datetime) -> str:
        return _utc_serializer(dt)


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    title_template: str = Field(min_length=1, max_length=200)
    description_template: Optional[str] = None
    priority: str = "medium"
    repeat: str = "none"
    reminder_before: int = Field(default=0, ge=0, le=10080)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v not in VALID_PRIORITY:
            raise ValueError(f"priority must be one of {VALID_PRIORITY}")
        return v


class TemplateRead(BaseModel):
    id: int
    user_id: int
    name: str
    title_template: str
    description_template: Optional[str]
    priority: str
    repeat: str
    reminder_before: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_dt(self, dt: datetime) -> str:
        return _utc_serializer(dt)


class TemplateApply(BaseModel):
    remind_at: datetime
    variables: dict[str, str] = Field(default_factory=dict)

    @field_validator("remind_at", mode="after")
    @classmethod
    def normalize_utc(cls, v: datetime) -> datetime:
        return _to_utc(v)


class NotificationLogRead(BaseModel):
    id: int
    reminder_id: int
    triggered_at: datetime
    status: str
    user_action: Optional[str]
    snooze_minutes: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("triggered_at", "created_at")
    def serialize_dt(self, dt: datetime) -> str:
        return _utc_serializer(dt)


class SnoozePayload(BaseModel):
    minutes: int = Field(default=5, ge=1, le=60)


class BulkActionPayload(BaseModel):
    ids: list[int] = Field(min_length=1)
    action: str

    @field_validator("action")
    @classmethod
    def validate_action(cls, v):
        if v not in {"complete", "delete"}:
            raise ValueError("action must be 'complete' or 'delete'")
        return v
