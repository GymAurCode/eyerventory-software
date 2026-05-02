from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.security import verify_password
from backend.database import get_db
from backend.routes.deps import get_current_user, require_roles
from backend.schemas.settings import (
    ClearDataRequest,
    CompanySettingsRead,
    CompanySettingsUpdate,
    DonationSettingsRead,
    DonationSettingsUpdate,
)
from backend.services import finance_service, settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


# ---------------------------------------------------------------------------
# Branding
# ---------------------------------------------------------------------------

@router.get("/branding", response_model=CompanySettingsRead)
def get_branding(db: Session = Depends(get_db)):
    return {"company_name": settings_service.get_company_name(db)}


@router.put("/branding", response_model=CompanySettingsRead)
def update_branding(payload: CompanySettingsUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return {"company_name": settings_service.update_company_name(db, payload.company_name)}


# ---------------------------------------------------------------------------
# Donation
# ---------------------------------------------------------------------------

@router.get("/donation", response_model=DonationSettingsRead)
def get_donation(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    s = settings_service.get_donation_settings(db)
    summary = finance_service.get_finance_summary(db)
    return {"enabled": s["enabled"], "percentage": s["percentage"], "donation_amount": summary["donation_amount"]}


@router.put("/donation", response_model=DonationSettingsRead)
def update_donation(payload: DonationSettingsUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    s = settings_service.update_donation_settings(db, payload.enabled, payload.percentage)
    summary = finance_service.get_finance_summary(db)
    return {"enabled": s["enabled"], "percentage": s["percentage"], "donation_amount": summary["donation_amount"]}


# ---------------------------------------------------------------------------
# Clear data
# ---------------------------------------------------------------------------

@router.post("/clear-data")
def clear_data(payload: ClearDataRequest, db: Session = Depends(get_db), user=Depends(get_current_user), _=Depends(require_roles("owner"))):
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid owner password")
    result = settings_service.clear_operational_data(db)
    return {"message": "Business data cleared successfully", "deleted": result}


# ---------------------------------------------------------------------------
# Auto Backup
# ---------------------------------------------------------------------------

class AutoBackupToggle(BaseModel):
    enabled: bool
    keep_history: bool = False


@router.get("/backup/status")
def backup_status(_=Depends(require_roles("owner"))):
    from backend.services.backup_service import get_status
    return get_status()


@router.post("/backup/now")
def backup_now_endpoint(_=Depends(require_roles("owner"))):
    from backend.services.backup_service import backup_now, _get, _KEY_KEEP_HISTORY
    keep = _get(_KEY_KEEP_HISTORY, "false") == "true"
    result = backup_now(keep_history=keep)
    if not result["ok"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Backup failed"))
    return result


@router.post("/backup/configure")
def configure_backup(payload: AutoBackupToggle, _=Depends(require_roles("owner"))):
    from backend.services.backup_service import enable_auto_backup, disable_auto_backup
    if payload.enabled:
        result = enable_auto_backup(keep_history=payload.keep_history)
        if not result.get("ok"):
            raise HTTPException(status_code=500, detail=result.get("error", "Backup failed"))
        return result
    else:
        return disable_auto_backup()
