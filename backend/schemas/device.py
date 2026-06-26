from datetime import datetime

from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    device_type: str = Field(min_length=1, max_length=60)
    status: str = Field(default="unknown", max_length=20)
    model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    firmware_version: str | None = Field(default=None, max_length=60)
    connection_type: str | None = Field(default=None, max_length=30)
    connection_method: str | None = Field(default=None, max_length=20)
    signal_strength: int | None = Field(default=None, ge=0, le=100)
    driver_status: str | None = Field(default=None, max_length=30)
    assigned_pos_terminal: str | None = Field(default=None, max_length=120)
    location_branch: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    device_type: str | None = Field(default=None, min_length=1, max_length=60)
    status: str | None = Field(default=None, max_length=20)
    model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    firmware_version: str | None = Field(default=None, max_length=60)
    connection_type: str | None = Field(default=None, max_length=30)
    connection_method: str | None = Field(default=None, max_length=20)
    signal_strength: int | None = Field(default=None, ge=0, le=100)
    driver_status: str | None = Field(default=None, max_length=30)
    assigned_pos_terminal: str | None = Field(default=None, max_length=120)
    location_branch: str | None = Field(default=None, max_length=120)
    error_message: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=500)


class DeviceRead(BaseModel):
    id: int
    name: str
    device_type: str
    status: str
    model: str | None
    serial_number: str | None
    firmware_version: str | None
    connection_type: str | None
    connection_method: str | None
    signal_strength: int | None
    driver_status: str | None
    last_connected_at: datetime | None
    last_activity_at: datetime | None
    assigned_pos_terminal: str | None
    location_branch: str | None
    error_message: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeviceStatusHistory(BaseModel):
    device_id: int
    status: str
    changed_at: datetime

    class Config:
        from_attributes = True
