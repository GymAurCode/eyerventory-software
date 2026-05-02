from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.credit import CreditTransaction
from backend.models.product import Product
from backend.routes.deps import require_roles
from backend.schemas.credit import (
    CreditCreate,
    CreditDetailRead,
    CreditListRead,
    CreditPaymentCreate,
    CreditSummaryRead,
    LedgerEntryRead,
)
from backend.services import credit_service

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("", response_model=list[CreditListRead])
def list_credits(
    party_type: str | None = Query(default=None, pattern="^(customer|supplier)$"),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(pending|partial|paid)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return credit_service.list_credits(db, party_type=party_type, status=status_filter)


@router.get("/{credit_id}", response_model=CreditDetailRead)
def credit_detail(credit_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    result = credit_service.get_credit_detail(db, credit_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit account not found")
    account, txns, items, payments, products, party_name = result
    return {
        **account.__dict__,
        "party_name": party_name,
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": t.amount,
                "description": t.description,
                "reference_id": t.reference_id,
                "created_at": t.created_at,
            }
            for t in txns
        ],
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": products.get(i.product_id, f"Product #{i.product_id}"),
                "quantity": i.quantity,
                "price": i.price,
                "total": i.total,
            }
            for i in items
        ],
        "payments": [{"id": p.id, "amount": p.amount, "method": p.method, "created_at": p.created_at} for p in payments],
    }


@router.post("/create", response_model=CreditListRead, status_code=status.HTTP_201_CREATED)
def create_credit(payload: CreditCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        account = credit_service.create_credit_account(
            db=db,
            party_type=payload.party_type,
            party_id=payload.party_id,
            amount=payload.amount,
            paid_amount=payload.paid_amount,
            reference_type=payload.type,
            reference_id=payload.reference_id,
            description=payload.description,
            due_date=payload.due_date,
            items=[item.model_dump() for item in payload.items],
        )
        db.commit()
        db.refresh(account)
        return account
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/payment", response_model=CreditListRead)
def post_payment(payload: CreditPaymentCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        account = credit_service.record_payment(db, payload.credit_account_id, payload.amount, payload.method, payload.description)
        db.commit()
        db.refresh(account)
        return account
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/ledger/{party_id}", response_model=list[LedgerEntryRead])
def party_ledger(
    party_id: int,
    party_type: str = Query(pattern="^(customer|supplier)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return credit_service.ledger_for_party(db, party_type=party_type, party_id=party_id)


@router.get("/reports/credit-summary", response_model=CreditSummaryRead)
def report_credit_summary(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return credit_service.credit_summary(db)
