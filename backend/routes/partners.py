from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.partners import OwnershipUpdate, PartnerRead
from backend.services import partner_service

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("", response_model=list[PartnerRead])
def list_partners(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return partner_service.list_partner_distribution(db)


@router.put("/{owner_user_id}/percentage", status_code=status.HTTP_204_NO_CONTENT)
def update_percentage(
    owner_user_id: int,
    payload: OwnershipUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        partner_service.update_owner_percentage(db, owner_user_id, payload.ownership_percentage)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
