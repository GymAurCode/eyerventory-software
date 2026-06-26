from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.device import DeviceCreate, DeviceRead, DeviceUpdate
from backend.services import device_service

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceRead])
def list_devices(
    device_type: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return device_service.list_devices(db, device_type, status)


@router.get("/types", response_model=list[str])
def get_device_types(_=Depends(require_roles("owner", "staff"))):
    return device_service.get_device_types()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return device_service.get_dashboard_stats(db)


@router.get("/{device_id}", response_model=DeviceRead)
def get_device(device_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    device = device_service.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.post("", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return device_service.create_device(db, payload)


@router.put("/{device_id}", response_model=DeviceRead)
def update_device(device_id: int, payload: DeviceUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    device = device_service.update_device(db, device_id, payload)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    ok = device_service.delete_device(db, device_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
