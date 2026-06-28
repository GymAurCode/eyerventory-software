from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import warehouse_service
from backend.schemas.warehouse import (
    AdjustmentCreate,
    COASettingRead,
    COASettingUpdate,
    DashboardStats,
    DamageCreate,
    OpeningStockCreate,
    OpeningStockRead,
    ReturnCreate,
    ReturnRead,
    StockInCreate,
    StockLedgerRead,
    StockMovementRead,
    StockOutCreate,
    StockTransferCreate,
    WarehouseCOAAccountCreate,
    WarehouseCOAAccountRead,
    WarehouseRead,
    WarehouseUpdate,
)

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


class WarehouseCreateLegacy(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = None
    location: str | None = None


class StockItem(BaseModel):
    product_id: int
    quantity: int
    unit_price: float | None = None
    notes: str | None = None


# ── Warehouse CRUD (legacy) ─────────────────────────────────────────────────

@router.get("")
def list_warehouses(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.list_warehouses(db)


@router.post("")
def create_warehouse(payload: WarehouseCreateLegacy, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return warehouse_service.create_warehouse(db, payload.name, payload.code, payload.location)


@router.get("/{warehouse_id}")
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    wh = warehouse_service.get_warehouse(db, warehouse_id)
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return wh


# ── Warehouse CRUD (rebuild) ────────────────────────────────────────────────

@router.put("/{warehouse_id}", response_model=WarehouseRead)
def update_warehouse(
    warehouse_id: int, payload: WarehouseUpdate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner")),
):
    try:
        return warehouse_service.update_warehouse_rebuild(db, warehouse_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        warehouse_service.delete_warehouse(db, warehouse_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ── COA Setting ─────────────────────────────────────────────────────────────

@router.get("/{warehouse_id}/coa-setting", response_model=COASettingRead)
def get_coa_setting(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return warehouse_service.get_coa_setting(db, warehouse_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{warehouse_id}/coa-setting", response_model=COASettingRead)
def update_coa_setting(
    warehouse_id: int, payload: COASettingUpdate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner")),
):
    return warehouse_service.update_coa_setting(db, warehouse_id, payload.mode, payload.linked_main_coa_accounts)


@router.get("/{warehouse_id}/coa-accounts", response_model=list[WarehouseCOAAccountRead])
def list_coa_accounts(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    warehouse_service.seed_warehouse_coa(db, warehouse_id)
    return db.query(warehouse_service.WarehouseCOAAccount).filter(
        warehouse_service.WarehouseCOAAccount.warehouse_id == warehouse_id,
    ).all()


@router.post("/{warehouse_id}/coa-seed")
def seed_coa(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    warehouse_service.seed_warehouse_coa(db, warehouse_id)
    return {"ok": True, "message": "COA accounts seeded"}


@router.get("/{warehouse_id}/coa-accounts/{account_id}")
def get_coa_account_detail(
    warehouse_id: int, account_id: int,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    result = warehouse_service.get_coa_account_detail(db, account_id)
    if not result:
        raise HTTPException(404, "Account not found")
    if result["account"].warehouse_id != warehouse_id:
        raise HTTPException(404, "Account not in this warehouse")
    return result


@router.post("/{warehouse_id}/coa-accounts", status_code=status.HTTP_201_CREATED)
def create_coa_account(
    warehouse_id: int, payload: WarehouseCOAAccountCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner")),
):
    try:
        return warehouse_service.create_custom_coa_account(db, warehouse_id, payload)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{warehouse_id}/coa-accounts/{account_id}")
def delete_coa_account(
    warehouse_id: int, account_id: int,
    db: Session = Depends(get_db), _=Depends(require_roles("owner")),
):
    try:
        warehouse_service.delete_coa_account(db, account_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{warehouse_id}/journal-entries")
def list_journal_entries(
    warehouse_id: int,
    account_id: int = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 200,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_journal_entries(
        db, warehouse_id, account_id, start_date, end_date, limit,
    )


@router.get("/{warehouse_id}/trial-balance")
def trial_balance(
    warehouse_id: int,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_trial_balance(db, warehouse_id)


# ── Opening Stock ───────────────────────────────────────────────────────────

@router.get("/{warehouse_id}/opening-stock", response_model=list[OpeningStockRead])
def get_opening_stock(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_opening_stock(db, warehouse_id)


@router.post("/{warehouse_id}/opening-stock", response_model=list[OpeningStockRead], status_code=status.HTTP_201_CREATED)
def set_opening_stock(
    warehouse_id: int, payload: list[OpeningStockCreate],
    db: Session = Depends(get_db), _=Depends(require_roles("owner")),
):
    return warehouse_service.set_opening_stock(
        db, warehouse_id,
        [it.model_dump() for it in payload],
    )


@router.post("/{warehouse_id}/opening-stock/lock")
def lock_opening_stock(warehouse_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    return warehouse_service.lock_opening_stock(db, warehouse_id)


# ── Stock Operations (legacy - alternative paths) ───────────────────────────

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


# ── Stock & Ledger Queries (legacy) ─────────────────────────────────────────

@router.get("/stock/summary")
def stock_summary(warehouse_id: int = Query(None), db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_stock_summary(db, warehouse_id)


@router.get("/stock/ledger")
def stock_ledger(
    product_id: int = Query(None), warehouse_id: int = Query(None),
    limit: int = Query(500),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_stock_ledger_legacy(db, product_id, warehouse_id, limit)


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


# ══════════════════════════════════════════════════════════════════════════════
# NEW REBUILD ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ── Stock Movements (rebuild) ───────────────────────────────────────────────

@router.get("/{warehouse_id}/stock-movements", response_model=list[StockMovementRead])
def list_stock_movements(
    warehouse_id: int, movement_type: str = Query(None),
    product_id: int = Query(None), limit: int = Query(100),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_stock_movements(
        db, warehouse_id=warehouse_id,
        movement_type=movement_type, product_id=product_id, limit=limit,
    )


@router.get("/{warehouse_id}/stock-ledger", response_model=list[StockLedgerRead])
def list_stock_ledger(
    warehouse_id: int, product_id: int = Query(None),
    limit: int = Query(500),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_stock_ledger(
        db, warehouse_id=warehouse_id,
        product_id=product_id, limit=limit,
    )


@router.post("/{warehouse_id}/stock-in", response_model=list[StockMovementRead], status_code=status.HTTP_201_CREATED)
def create_stock_in(
    warehouse_id: int, payload: StockInCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.stock_in(db, payload.model_dump())


@router.post("/{warehouse_id}/stock-out", response_model=list[StockMovementRead], status_code=status.HTTP_201_CREATED)
def create_stock_out(
    warehouse_id: int, payload: StockOutCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.stock_out(db, payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/transfer", status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: StockTransferCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.transfer_stock(db, payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{warehouse_id}/damage", response_model=StockMovementRead, status_code=status.HTTP_201_CREATED)
def create_damage(
    warehouse_id: int, payload: DamageCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.report_damage(db, payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{warehouse_id}/adjust", response_model=list[StockMovementRead], status_code=status.HTTP_201_CREATED)
def create_adjustment(
    warehouse_id: int, payload: AdjustmentCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    try:
        return warehouse_service.adjust_stock(db, payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{warehouse_id}/returns", response_model=list[ReturnRead])
def list_returns(
    warehouse_id: int, return_type: str = Query(None),
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    return warehouse_service.get_returns(db, warehouse_id=warehouse_id, return_type=return_type)


@router.post("/{warehouse_id}/returns", response_model=ReturnRead, status_code=status.HTTP_201_CREATED)
def create_return(
    warehouse_id: int, payload: ReturnCreate,
    db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff")),
):
    data = payload.model_dump()
    data["warehouse_id"] = warehouse_id
    return warehouse_service.create_return(db, data)


# ── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return warehouse_service.get_dashboard_stats(db)
