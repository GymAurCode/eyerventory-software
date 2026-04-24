from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services.finance_service import get_finance_summary, get_profit_loss

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/summary")
def finance_summary(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return get_finance_summary(db)


@router.get("/pnl")
def profit_loss_statement(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    """P&L — salary expense sourced exclusively from HR Payments."""
    return get_profit_loss(db)
