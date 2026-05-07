from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import accounting_service

router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/accounts")
def get_accounts(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    return accounting_service.get_all_account_balances(db)


@router.get("/journal-entries")
def get_journal_entries(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    from backend.models.journal import JournalEntry
    entries = db.query(JournalEntry).order_by(JournalEntry.date.desc()).all()
    return [
        {
            "id": e.id,
            "date": e.date.isoformat() if e.date else None,
            "description": e.description,
            "reference_type": e.reference_type,
            "reference_id": e.reference_id,
            "items": [
                {
                    "account_name": item.account.name if item.account else None,
                    "account_type": item.account.type if item.account else None,
                    "debit":  item.debit,
                    "credit": item.credit,
                }
                for item in e.journal_items
            ],
        }
        for e in entries
    ]


@router.get("/trial-balance")
def get_trial_balance(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    rows = accounting_service.get_all_account_balances(db)
    total_dr = sum(r["total_debit"]  for r in rows)
    total_cr = sum(r["total_credit"] for r in rows)
    return {
        "accounts": rows,
        "total_debit":  round(total_dr, 2),
        "total_credit": round(total_cr, 2),
        "balanced":     abs(total_dr - total_cr) < 0.01,
    }


@router.get("/profit-loss")
def get_profit_loss(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    return accounting_service.calculate_profit_loss(db)


@router.get("/balance-sheet")
def get_balance_sheet(db: Session = Depends(get_db), _=Depends(require_roles("owner", "admin"))):
    return accounting_service.get_balance_sheet(db)


@router.get("/account/{account_id}/ledger")
def get_account_ledger(
    account_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin")),
):
    from backend.models.account import Account
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return {
        "account": {"id": account.id, "code": account.code, "name": account.name, "type": account.type},
        "entries": accounting_service.get_account_ledger(db, account_id),
    }


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
