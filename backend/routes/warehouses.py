from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import warehouse_service

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


class WarehouseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = None
    location: str | None = None


class StockItem(BaseModel):
    product_id: int
    quantity: int
    unit_price: float | None = None
    notes: str | None = None


# ── Warehouse CRUD ──────────────────────────────────────────────────────────

@router.get("")
def list_warehouses(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.list_warehouses(db)


@router.post("")
def create_warehouse(payload: WarehouseCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return warehouse_service.create_warehouse(db, payload.name, payload.code, payload.location)


@router.get("/{warehouse_id}")
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    wh = warehouse_service.get_warehouse(db, warehouse_id)
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return wh


# ── Stock Operations ────────────────────────────────────────────────────────

@router.post("/{warehouse_id}/stock-in")
def stock_in(
    warehouse_id: int, payload: list[StockItem],
    reference_no: str = Query(None), notes: str = Query(None),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.stock_in(
        db, warehouse_id,
        [it.model_dump() for it in payload],
        reference_no=reference_no, notes=notes, created_by="user",
    )


@router.post("/{warehouse_id}/stock-out")
def stock_out(
    warehouse_id: int, payload: list[StockItem],
    reference_no: str = Query(None), notes: str = Query(None),
    allow_negative: bool = Query(False),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.stock_out(
            db, warehouse_id,
            [it.model_dump() for it in payload],
            reference_no=reference_no, notes=notes,
            allow_negative=allow_negative, created_by="user",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/transfer")
def transfer(
    source_warehouse_id: int = Query(...), dest_warehouse_id: int = Query(...),
    payload: list[StockItem] = ...,
    reference_no: str = Query(None), notes: str = Query(None),
    allow_negative: bool = Query(False),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.transfer(
            db, source_warehouse_id, dest_warehouse_id,
            [it.model_dump() for it in payload],
            reference_no=reference_no, notes=notes,
            allow_negative=allow_negative, created_by="user",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{warehouse_id}/adjust")
def adjust_stock(
    warehouse_id: int, payload: list[StockItem],
    notes: str = Query(None), allow_negative: bool = Query(False),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.adjust_stock(
            db, warehouse_id,
            [it.model_dump() for it in payload],
            notes=notes, allow_negative=allow_negative, created_by="user",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{warehouse_id}/return-supplier")
def return_to_supplier(
    warehouse_id: int, supplier_id: int = Query(...),
    payload: list[StockItem] = ...,
    reference_no: str = Query(None), notes: str = Query(None),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.return_to_supplier(
            db, warehouse_id, supplier_id,
            [it.model_dump() for it in payload],
            reference_no=reference_no, notes=notes, created_by="user",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{warehouse_id}/damage")
def report_damage(
    warehouse_id: int, product_id: int = Query(...), quantity: int = Query(...),
    reason: str = Query(None),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.report_damage(
            db, warehouse_id, product_id, quantity,
            reason=reason, reported_by="user",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{warehouse_id}/opening-stock")
def set_opening_stock(
    warehouse_id: int, payload: list[StockItem],
    db: Session = Depends(get_db), _=Depends(require_roles("owner")),
):
    return warehouse_service.set_opening_stock(
        db, warehouse_id,
        [it.model_dump() for it in payload],
        created_by="user",
    )


# ── Cycle Count ─────────────────────────────────────────────────────────────

@router.post("/{warehouse_id}/cycle-count")
def create_cycle_count(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.create_cycle_count(db, warehouse_id, created_by="user")


@router.put("/cycle-count/{count_id}/item/{item_id}")
def update_cycle_count_item(count_id: int, item_id: int, counted_qty: int = Query(...), db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    item = warehouse_service.update_cycle_count_item(db, item_id, counted_qty)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.post("/cycle-count/{count_id}/complete")
def complete_cycle_count(count_id: int, allow_negative: bool = Query(False), db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        return warehouse_service.complete_cycle_count(db, count_id, created_by="user", allow_negative=allow_negative)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── Stock & Ledger Queries ──────────────────────────────────────────────────

@router.get("/stock/summary")
def stock_summary(warehouse_id: int = Query(None), db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_stock_summary(db, warehouse_id)


@router.get("/stock/ledger")
def stock_ledger(
    product_id: int = Query(None), warehouse_id: int = Query(None),
    limit: int = Query(500),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_stock_ledger(db, product_id, warehouse_id, limit)


@router.get("/stock/low-stock")
def low_stock(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_low_stock_items(db)


@router.get("/stock/transactions")
def list_transactions(
    transaction_type: str = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_all_transactions(db, transaction_type, limit)


@router.get("/damage-reports")
def damage_reports(warehouse_id: int = Query(None), db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_damage_reports(db, warehouse_id)


# ── Reports ─────────────────────────────────────────────────────────────────

@router.get("/reports/summary")
def warehouse_summary(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_warehouse_summary(db)


@router.post("/reports/calculate-closing")
def calculate_closing(db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    warehouse_service.calculate_daily_closing(db)
    return {"message": "Closing stock calculated"}
