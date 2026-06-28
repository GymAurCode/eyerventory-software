from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.warehouse import ShopCreate, ShopDetail, ShopRead, ShopUpdate
from backend.services import warehouse_service

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("", response_model=list[ShopRead])
def list_shops(
    area_id: int = Query(None),
    salesman_id: int = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_shops(db, area_id=area_id, salesman_id=salesman_id)


@router.post("", response_model=ShopRead, status_code=status.HTTP_201_CREATED)
def create_shop(
    payload: ShopCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.create_shop(db, payload)


@router.get("/{shop_id}", response_model=ShopDetail)
def get_shop_detail(
    shop_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.get_shop_detail(db, shop_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{shop_id}", response_model=ShopRead)
def update_shop(
    shop_id: int,
    payload: ShopUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.update_shop(db, shop_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shop(
    shop_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        warehouse_service.delete_shop(db, shop_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{shop_id}/ledger")
def get_shop_ledger(
    shop_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        shop = warehouse_service.get_shop(db, shop_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    invoices = warehouse_service.get_invoices(db, shop_id=shop_id)
    payments = warehouse_service.get_payments(db, shop_id=shop_id)

    entries = []
    running_balance = 0.0

    for inv in invoices:
        running_balance += inv.net_total
        entries.append({
            "date": inv.date,
            "type": "invoice",
            "reference": inv.invoice_no,
            "debit": inv.net_total,
            "credit": 0,
            "balance": running_balance,
            "status": inv.status,
        })

    for p in payments:
        running_balance -= p.amount
        entries.append({
            "date": p.date,
            "type": "payment",
            "reference": p.reference or f"Payment #{p.id}",
            "debit": 0,
            "credit": p.amount,
            "balance": running_balance,
            "payment_mode": p.payment_mode,
        })

    entries.sort(key=lambda x: x["date"])
    return {
        "shop_id": shop.id,
        "shop_name": shop.name,
        "entries": entries,
    }
