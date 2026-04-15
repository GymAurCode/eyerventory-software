from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import get_current_user, require_roles
from backend.schemas.sale import SaleCreate, SaleRead, SaleStaffRead, SaleUpdate
from backend.services import sale_service

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=list[SaleRead] | list[SaleStaffRead])
def list_sales(db: Session = Depends(get_db), user=Depends(get_current_user), _=Depends(require_roles("owner", "staff"))):
    rows = sale_service.list_sales(db)
    if user.role == "owner":
        return rows
    return [
        {
            "id": row.id,
            "product_id": row.product_id,
            "quantity": row.quantity,
            "selling_price": row.selling_price,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("", response_model=SaleRead, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return sale_service.create_sale(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{sale_id}", response_model=SaleRead)
def update_sale(sale_id: int, payload: SaleUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        sale = sale_service.update_sale(db, sale_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(sale_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    ok = sale_service.delete_sale(db, sale_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
