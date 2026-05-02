from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.credit import LedgerEntryRead
from backend.services import credit_service

router = APIRouter(prefix="/ledger", tags=["ledger"])


@router.get("/{party_id}", response_model=list[LedgerEntryRead])
def list_party_ledger(
    party_id: int,
    party_type: str = Query(pattern="^(customer|supplier)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return credit_service.ledger_for_party(db, party_type=party_type, party_id=party_id)
