from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.security import verify_password
from backend.database import get_db
from backend.routes.deps import get_current_user, require_roles
from backend.schemas.settings import ClearDataRequest, CompanySettingsRead, CompanySettingsUpdate, DonationSettingsRead, DonationSettingsUpdate
from backend.services import finance_service, settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/branding", response_model=CompanySettingsRead)
def get_branding(db: Session = Depends(get_db)):
    return {"company_name": settings_service.get_company_name(db)}


@router.put("/branding", response_model=CompanySettingsRead)
def update_branding(payload: CompanySettingsUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return {"company_name": settings_service.update_company_name(db, payload.company_name)}


@router.get("/donation", response_model=DonationSettingsRead)
def get_donation(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    settings = settings_service.get_donation_settings(db)
    summary = finance_service.get_finance_summary(db)
    return {
        "enabled": settings["enabled"],
        "percentage": settings["percentage"],
        "donation_amount": summary["donation_amount"],
    }


@router.put("/donation", response_model=DonationSettingsRead)
def update_donation(payload: DonationSettingsUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    settings = settings_service.update_donation_settings(db, payload.enabled, payload.percentage)
    summary = finance_service.get_finance_summary(db)
    return {
        "enabled": settings["enabled"],
        "percentage": settings["percentage"],
        "donation_amount": summary["donation_amount"],
    }


@router.post("/clear-data")
def clear_data(payload: ClearDataRequest, db: Session = Depends(get_db), user=Depends(get_current_user), _=Depends(require_roles("owner"))):
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid owner password")
    result = settings_service.clear_operational_data(db)
    return {"message": "Business data cleared successfully", "deleted": result}
