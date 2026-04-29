from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import accounting_service

router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/accounts")
def get_accounts(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    from backend.models.account import Account
    accounts = db.query(Account).all()
    return [
        {
            "id": acc.id,
            "name": acc.name,
            "type": acc.type,
            "balance": accounting_service.get_account_balance(db, acc.name),
        }
        for acc in accounts
    ]


@router.get("/journal-entries")
def get_journal_entries(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    from backend.models.journal import JournalEntry
    entries = db.query(JournalEntry).order_by(JournalEntry.date.desc()).all()
    return [
        {
            "id": entry.id,
            "date": entry.date.isoformat() if entry.date else None,
            "description": entry.description,
            "reference_type": entry.reference_type,
            "reference_id": entry.reference_id,
            "items": [
                {
                    "account_name": item.account.name if item.account else None,
                    "debit": item.debit,
                    "credit": item.credit,
                }
                for item in entry.journal_items
            ],
        }
        for entry in entries
    ]


@router.get("/balance-sheet")
def get_balance_sheet(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    """Full balance sheet: assets, liabilities, equity with per-account breakdown."""
    return accounting_service.get_balance_sheet(db)


@router.get("/profit-loss")
def get_profit_loss(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    """Profit & Loss: revenue, expenses, net profit."""
    return accounting_service.calculate_profit_loss(db)


@router.get("/account/{account_name}/balance")
def get_account_balance(
    account_name: str,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin")),
):
    from backend.models.account import Account
    account = db.query(Account).filter(Account.name == account_name).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return {
        "account_name": account.name,
        "account_type": account.type,
        "balance": accounting_service.get_account_balance(db, account_name),
    }
