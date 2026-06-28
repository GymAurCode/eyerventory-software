from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.partner_agreement import (
    PartnerAgreementCreate,
    PartnerAgreementRead,
    PartnerAgreementUpdate,
)
from backend.services import partner_agreement_service

router = APIRouter(prefix="/partner-agreements", tags=["partner-agreements"])


@router.get("/user/{user_id}", response_model=list[PartnerAgreementRead])
def list_agreements_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    return partner_agreement_service.get_agreements_for_user(db, user_id)


@router.get("", response_model=list[PartnerAgreementRead])
def list_all_agreements(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    return partner_agreement_service.get_active_agreements(db)


@router.post("", response_model=PartnerAgreementRead, status_code=status.HTTP_201_CREATED)
def create_agreement(
    payload: PartnerAgreementCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        agreement = partner_agreement_service.create_agreement(db, payload.model_dump())
        db.commit()
        return agreement
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{agreement_id}", response_model=PartnerAgreementRead)
def get_agreement(
    agreement_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    agreement = partner_agreement_service.get_agreement_by_id(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agreement not found")
    return agreement


@router.put("/{agreement_id}", response_model=PartnerAgreementRead)
def update_agreement(
    agreement_id: int,
    payload: PartnerAgreementUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        agreement = partner_agreement_service.update_agreement(db, agreement_id, update_data)
        db.commit()
        return agreement
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
