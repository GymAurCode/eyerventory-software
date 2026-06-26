from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.models.device import Device
from backend.schemas.device import DeviceCreate, DeviceUpdate


DEVICE_TYPES = [
    "receipt_printer",
    "barcode_scanner",
    "cash_drawer",
    "thermal_printer",
    "label_printer",
    "customer_display",
    "card_payment_terminal",
    "qr_payment_device",
    "weighing_scale",
    "fingerprint_device",
    "rfid_reader",
    "network_pos_device",
]


def list_devices(db: Session, device_type: str | None = None, status: str | None = None):
    query = db.query(Device).order_by(Device.name.asc())
    if device_type:
        query = query.filter(Device.device_type == device_type)
    if status:
        query = query.filter(Device.status == status)
    return query.all()


def get_device(db: Session, device_id: int):
    return db.query(Device).filter(Device.id == device_id).first()


def create_device(db: Session, payload: DeviceCreate):
    device = Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def update_device(db: Session, device_id: int, payload: DeviceUpdate):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    update_data = payload.model_dump(exclude_none=True)
    if "status" in update_data:
        update_data["last_activity_at"] = datetime.now(timezone.utc)
        if update_data["status"] == "connected":
            update_data["last_connected_at"] = datetime.now(timezone.utc)
    for key, value in update_data.items():
        setattr(device, key, value)
    db.commit()
    db.refresh(device)
    return device


def delete_device(db: Session, device_id: int) -> bool:
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return False
    db.delete(device)
    db.commit()
    return True


def get_device_types():
    return DEVICE_TYPES


def get_dashboard_stats(db: Session):
    total = db.query(Device).count()
    connected = db.query(Device).filter(Device.status == "connected").count()
    disconnected = db.query(Device).filter(Device.status == "disconnected").count()
    unknown = db.query(Device).filter(Device.status == "unknown").count()
    return {
        "total": total,
        "connected": connected,
        "disconnected": disconnected,
        "unknown": unknown,
    }
