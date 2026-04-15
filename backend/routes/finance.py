from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.finance import FinanceSummary
from backend.services.finance_service import get_finance_summary

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/summary", response_model=FinanceSummary)
def finance_summary(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return get_finance_summary(db)
