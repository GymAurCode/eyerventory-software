from sqlalchemy import Column, DateTime, Float, Integer, String, Text, ForeignKey
from sqlalchemy.sql import func
from backend.database import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    remind_at = Column(DateTime(timezone=True), nullable=False, index=True)
    priority = Column(String(10), nullable=False, default="medium")   # low | medium | high
    repeat = Column(String(10), nullable=False, default="none")       # none | daily | weekly | monthly
    status = Column(String(12), nullable=False, default="pending")    # pending | completed | snoozed
    reminder_before = Column(Integer, nullable=False, default=0)      # minutes before remind_at to fire
    template_id = Column(Integer, ForeignKey("reminder_templates.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ReminderTemplate(Base):
    __tablename__ = "reminder_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    title_template = Column(String(200), nullable=False)
    description_template = Column(Text, nullable=True)
    priority = Column(String(10), nullable=False, default="medium")
    repeat = Column(String(10), nullable=False, default="none")
    reminder_before = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(12), nullable=False, default="delivered")  # delivered | missed | failed
    user_action = Column(String(12), nullable=True)                   # snoozed | completed | ignored | None
    snooze_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
