from datetime import datetime, timedelta

from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.warehouse import (
    Area,
    ClosingStock,
    COASetting,
    CycleCount,
    CycleCountItem,
    DamageInventory,
    Invoice,
    InvoiceItem,
    OpeningStock,
    Return,
    SalesmanWarehouse,
    Shop,
    ShopPayment,
    StockLedger,
    StockMovement,
    StockTransaction,
    StockTransactionItem,
    Warehouse,
    WarehouseCOAAccount,
    WarehouseJournalEntry,
    WarehouseJournalLine,
    WarehouseStock,
)

# ── Transaction number generation ────────────────────────────────────────────

def _next_transaction_no(db: Session, prefix: str) -> str:
    last = db.query(StockTransaction.transaction_no).filter(
        StockTransaction.transaction_no.like(f"{prefix}%")
    ).order_by(StockTransaction.id.desc()).first()
    if last:
        try:
            num = int(last[0].split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"{prefix}-{num:05d}"

def _next_invoice_no(db: Session) -> str:
    last = db.query(Invoice.invoice_no).order_by(Invoice.id.desc()).first()
    if last:
        try:
            num = int(last[0].split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"INV-{num:05d}"

# ── Warehouse CRUD ──────────────────────────────────────────────────────────

def list_warehouses(db: Session):
    return db.query(Warehouse).order_by(Warehouse.name).all()


def get_warehouse(db: Session, warehouse_id: int):
    return db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()


def create_warehouse(db: Session, name: str, code: str = None, location: str = None):
    wh = Warehouse(name=name, code=code, location=location)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


def update_warehouse(db: Session, warehouse_id: int, **kwargs):
    wh = get_warehouse(db, warehouse_id)
    if not wh:
        return None
    for k, v in kwargs.items():
        if v is not None and hasattr(wh, k):
            setattr(wh, k, v)
    db.commit()
    db.refresh(wh)
    return wh

# ── Warehouse CRUD (rebuild) ────────────────────────────────────────────────

def create_warehouse_rebuild(db: Session, payload) -> Warehouse:
    wh = Warehouse(
        name=payload.name,
        location=payload.location,
        manager_id=payload.manager_id,
        status=payload.status if hasattr(payload, 'status') else "active",
        allow_negative_stock=1 if payload.allow_negative_stock else 0,
        coa_mode=payload.coa_mode if hasattr(payload, 'coa_mode') else "separate",
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    seed_warehouse_coa(db, wh.id)
    return wh


def update_warehouse_rebuild(db: Session, warehouse_id: int, payload) -> Warehouse:
    wh = get_warehouse(db, warehouse_id)
    if not wh:
        raise ValueError("Warehouse not found")
    update_data = payload.model_dump(exclude_unset=True)
    if "allow_negative_stock" in update_data:
        update_data["allow_negative_stock"] = 1 if update_data["allow_negative_stock"] else 0
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    for k, v in update_data.items():
        if v is not None and hasattr(wh, k):
            setattr(wh, k, v)
    db.commit()
    db.refresh(wh)
    return wh


def delete_warehouse(db: Session, warehouse_id: int):
    wh = get_warehouse(db, warehouse_id)
    if not wh:
        raise ValueError("Warehouse not found")
    db.delete(wh)
    db.commit()

# ── Stock helpers ───────────────────────────────────────────────────────────

def get_warehouse_stock(db: Session, warehouse_id: int, product_id: int):
    return db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == warehouse_id,
        WarehouseStock.product_id == product_id,
    ).first()


def ensure_warehouse_stock(db: Session, warehouse_id: int, product_id: int):
    ws = get_warehouse_stock(db, warehouse_id, product_id)
    if not ws:
        ws = WarehouseStock(warehouse_id=warehouse_id, product_id=product_id, quantity=0)
        db.add(ws)
        db.flush()
    return ws


def update_product_total_stock(db: Session, product_id: int):
    total = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseStock.quantity), 0)).filter(
        WarehouseStock.product_id == product_id,
    ).scalar()
    product = db.query(Product).filter(Product.id == product_id).first()
    if product:
        product.stock = int(total)
        db.flush()

# ── Stock Ledger ────────────────────────────────────────────────────────────

def record_ledger(
    db: Session, product_id: int, warehouse_id: int,
    transaction_type: str, quantity: int, balance_before: int, balance_after: int,
    unit_price: float = None, total_amount: float = None,
    description: str = None, reference_type: str = None, reference_id: int = None,
    created_by: str = None,
):
    db.add(StockLedger(
        product_id=product_id, warehouse_id=warehouse_id,
        transaction_type=transaction_type, quantity=quantity,
        balance_before=balance_before, balance_after=balance_after,
        rate=unit_price, value=total_amount,
        notes=description, reference_type=reference_type, reference_id=reference_id,
        created_by=created_by,
    ))

# ── Stock In (Supplier Receipt) ─────────────────────────────────────────────

def stock_in_legacy(
    db: Session, warehouse_id: int, items: list[dict],
    reference_no: str = None, notes: str = None, created_by: str = None,
):
    txn_no = _next_transaction_no(db, "SIN")
    txn = StockTransaction(
        transaction_no=txn_no, transaction_type="stock_in",
        dest_warehouse_id=warehouse_id,
        reference_no=reference_no, notes=notes, created_by=created_by,
    )
    db.add(txn)
    db.flush()

    for it in items:
        product_id = it["product_id"]
        qty = int(it["quantity"])
        price = float(it.get("unit_price", 0))

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        before = ws.quantity
        ws.quantity += qty
        db.flush()
        after = ws.quantity

        db.add(StockTransactionItem(
            transaction_id=txn.id, product_id=product_id,
            quantity=qty, unit_price=price, total_price=qty * price,
            notes=it.get("notes"),
        ))
        record_ledger(
            db, product_id, warehouse_id,
            "stock_in", qty, before, after,
            unit_price=price, total_amount=qty * price,
            description=f"Stock In: {reference_no or txn_no}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )
        update_product_total_stock(db, product_id)

    db.commit()
    db.refresh(txn)
    return txn

# ── Stock Out ───────────────────────────────────────────────────────────────

def stock_out_legacy(
    db: Session, warehouse_id: int, items: list[dict],
    reference_no: str = None, notes: str = None, created_by: str = None,
    allow_negative: bool = False,
):
    for it in items:
        ws = get_warehouse_stock(db, warehouse_id, it["product_id"])
        current = ws.quantity if ws else 0
        qty = int(it["quantity"])
        if not allow_negative and current < qty:
            raise ValueError(f"Insufficient stock for product #{it['product_id']}: have {current}, need {qty}")

    txn_no = _next_transaction_no(db, "SOUT")
    txn = StockTransaction(
        transaction_no=txn_no, transaction_type="stock_out",
        source_warehouse_id=warehouse_id,
        reference_no=reference_no, notes=notes, created_by=created_by,
    )
    db.add(txn)
    db.flush()

    for it in items:
        product_id = it["product_id"]
        qty = int(it["quantity"])
        price = float(it.get("unit_price", 0))

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        before = ws.quantity
        ws.quantity -= qty
        db.flush()
        after = ws.quantity

        db.add(StockTransactionItem(
            transaction_id=txn.id, product_id=product_id,
            quantity=-qty, unit_price=price, total_price=qty * price,
            notes=it.get("notes"),
        ))
        record_ledger(
            db, product_id, warehouse_id,
            "stock_out", -qty, before, after,
            unit_price=price, total_amount=qty * price,
            description=f"Stock Out: {reference_no or txn_no}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )
        update_product_total_stock(db, product_id)

    db.commit()
    db.refresh(txn)
    return txn

# ── Transfer between warehouses ─────────────────────────────────────────────

def transfer_legacy(
    db: Session, source_warehouse_id: int, dest_warehouse_id: int, items: list[dict],
    reference_no: str = None, notes: str = None, created_by: str = None,
    allow_negative: bool = False,
):
    if source_warehouse_id == dest_warehouse_id:
        raise ValueError("Source and destination warehouses must be different")

    for it in items:
        ws = get_warehouse_stock(db, source_warehouse_id, it["product_id"])
        current = ws.quantity if ws else 0
        qty = int(it["quantity"])
        if not allow_negative and current < qty:
            raise ValueError(f"Insufficient stock in source for product #{it['product_id']}: have {current}, need {qty}")

    txn_no = _next_transaction_no(db, "TRF")
    txn = StockTransaction(
        transaction_no=txn_no, transaction_type="transfer",
        source_warehouse_id=source_warehouse_id, dest_warehouse_id=dest_warehouse_id,
        reference_no=reference_no, notes=notes, created_by=created_by,
    )
    db.add(txn)
    db.flush()

    for it in items:
        product_id = it["product_id"]
        qty = int(it["quantity"])
        price = float(it.get("unit_price", 0))

        ws_src = ensure_warehouse_stock(db, source_warehouse_id, product_id)
        before_src = ws_src.quantity
        ws_src.quantity -= qty
        db.flush()
        after_src = ws_src.quantity
        record_ledger(
            db, product_id, source_warehouse_id,
            "transfer_out", -qty, before_src, after_src,
            description=f"Transfer Out to #{dest_warehouse_id}: {reference_no or txn_no}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )

        ws_dst = ensure_warehouse_stock(db, dest_warehouse_id, product_id)
        before_dst = ws_dst.quantity
        ws_dst.quantity += qty
        db.flush()
        after_dst = ws_dst.quantity
        record_ledger(
            db, product_id, dest_warehouse_id,
            "transfer_in", qty, before_dst, after_dst,
            description=f"Transfer In from #{source_warehouse_id}: {reference_no or txn_no}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )

        db.add(StockTransactionItem(
            transaction_id=txn.id, product_id=product_id,
            quantity=qty, unit_price=price, total_price=qty * price,
            notes=it.get("notes"),
        ))
        update_product_total_stock(db, product_id)

    db.commit()
    db.refresh(txn)
    return txn

# ── Stock Adjustment ────────────────────────────────────────────────────────

def adjust_stock_legacy(
    db: Session, warehouse_id: int, items: list[dict],
    notes: str = None, created_by: str = None,
    allow_negative: bool = False,
):
    txn_no = _next_transaction_no(db, "ADJ")
    txn = StockTransaction(
        transaction_no=txn_no, transaction_type="adjustment",
        dest_warehouse_id=warehouse_id,
        notes=notes, created_by=created_by,
    )
    db.add(txn)
    db.flush()

    for it in items:
        product_id = it["product_id"]
        adjustment = int(it["quantity"])
        price = float(it.get("unit_price", 0))

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        before = ws.quantity
        new_qty = ws.quantity + adjustment
        if not allow_negative and new_qty < 0:
            raise ValueError(f"Adjustment would cause negative stock for product #{product_id}")
        ws.quantity = new_qty
        db.flush()
        after = ws.quantity

        db.add(StockTransactionItem(
            transaction_id=txn.id, product_id=product_id,
            quantity=adjustment, unit_price=price, total_price=abs(adjustment) * price,
            notes=it.get("notes"),
        ))
        record_ledger(
            db, product_id, warehouse_id,
            "adjustment", adjustment, before, after,
            unit_price=price, total_amount=abs(adjustment) * price,
            description=f"Stock Adjustment: {notes or txn_no}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )
        update_product_total_stock(db, product_id)

    db.commit()
    db.refresh(txn)
    return txn

# ── Supplier Return ─────────────────────────────────────────────────────────

def return_to_supplier(
    db: Session, warehouse_id: int, supplier_id: int, items: list[dict],
    reference_no: str = None, notes: str = None, created_by: str = None,
):
    for it in items:
        ws = get_warehouse_stock(db, warehouse_id, it["product_id"])
        current = ws.quantity if ws else 0
        qty = int(it["quantity"])
        if current < qty:
            raise ValueError(f"Insufficient stock for return: product #{it['product_id']}, have {current}, need {qty}")

    txn_no = _next_transaction_no(db, "SRTN")
    txn = StockTransaction(
        transaction_no=txn_no, transaction_type="return_supplier",
        source_warehouse_id=warehouse_id, supplier_id=supplier_id,
        reference_no=reference_no, notes=notes, created_by=created_by,
    )
    db.add(txn)
    db.flush()

    for it in items:
        product_id = it["product_id"]
        qty = int(it["quantity"])
        price = float(it.get("unit_price", 0))

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        before = ws.quantity
        ws.quantity -= qty
        db.flush()
        after = ws.quantity

        db.add(StockTransactionItem(
            transaction_id=txn.id, product_id=product_id,
            quantity=-qty, unit_price=price, total_price=qty * price,
            notes=it.get("notes"),
        ))
        record_ledger(
            db, product_id, warehouse_id,
            "return", -qty, before, after,
            unit_price=price, total_amount=qty * price,
            description=f"Return to Supplier: {reference_no or txn_no}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )
        update_product_total_stock(db, product_id)

    db.commit()
    db.refresh(txn)
    return txn

# ── Damage Inventory ────────────────────────────────────────────────────────

def report_damage_legacy(
    db: Session, warehouse_id: int, product_id: int, quantity: int,
    reason: str = None, reported_by: str = None,
):
    ws = ensure_warehouse_stock(db, warehouse_id, product_id)
    if ws.quantity < quantity:
        raise ValueError(f"Insufficient stock: have {ws.quantity}, damage {quantity}")

    before = ws.quantity
    ws.quantity -= quantity
    db.flush()
    after = ws.quantity

    damage = DamageInventory(
        product_id=product_id, warehouse_id=warehouse_id,
        quantity=quantity, reason=reason, reported_by=reported_by,
    )
    db.add(damage)
    db.flush()

    record_ledger(
        db, product_id, warehouse_id,
        "damage", -quantity, before, after,
        description=f"Damaged: {reason or 'No reason'}",
        reference_type="damage", reference_id=damage.id,
        created_by=reported_by,
    )
    update_product_total_stock(db, product_id)
    db.commit()
    db.refresh(damage)
    return damage

# ── Opening Stock ───────────────────────────────────────────────────────────

def set_opening_stock_legacy(
    db: Session, warehouse_id: int, items: list[dict],
    created_by: str = None,
):
    txn_no = _next_transaction_no(db, "OPN")
    txn = StockTransaction(
        transaction_no=txn_no, transaction_type="opening",
        dest_warehouse_id=warehouse_id,
        notes="Opening stock entry", created_by=created_by,
    )
    db.add(txn)
    db.flush()

    for it in items:
        product_id = it["product_id"]
        qty = int(it["quantity"])
        price = float(it.get("unit_price", 0))

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        before = ws.quantity
        ws.quantity = qty
        db.flush()
        after = ws.quantity

        db.add(StockTransactionItem(
            transaction_id=txn.id, product_id=product_id,
            quantity=qty, unit_price=price, total_price=qty * price,
        ))
        record_ledger(
            db, product_id, warehouse_id,
            "opening", qty, before, after,
            unit_price=price, total_amount=qty * price,
            description=f"Opening Stock: {warehouse_id}",
            reference_type="stock_transaction", reference_id=txn.id,
            created_by=created_by,
        )
        update_product_total_stock(db, product_id)

    db.commit()
    db.refresh(txn)
    return txn

# ── Cycle Count ─────────────────────────────────────────────────────────────

def create_cycle_count(db: Session, warehouse_id: int, created_by: str = None):
    cc = CycleCount(warehouse_id=warehouse_id, status="draft", created_by=created_by)
    db.add(cc)
    db.flush()

    products = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == warehouse_id,
    ).all()
    for ws in products:
        db.add(CycleCountItem(
            cycle_count_id=cc.id, product_id=ws.product_id,
            system_qty=ws.quantity, counted_qty=ws.quantity, variance=0,
        ))
    db.commit()
    db.refresh(cc)
    return cc


def update_cycle_count_item(db: Session, item_id: int, counted_qty: int):
    item = db.query(CycleCountItem).filter(CycleCountItem.id == item_id).first()
    if not item:
        return None
    item.counted_qty = counted_qty
    item.variance = counted_qty - item.system_qty
    db.commit()
    db.refresh(item)
    return item


def complete_cycle_count(db: Session, cycle_count_id: int, created_by: str = None, allow_negative: bool = False):
    cc = db.query(CycleCount).filter(CycleCount.id == cycle_count_id).first()
    if not cc:
        return None
    if cc.status == "completed":
        raise ValueError("Cycle count already completed")

    for item in cc.items:
        if item.variance != 0:
            ws = ensure_warehouse_stock(db, cc.warehouse_id, item.product_id)
            before = ws.quantity
            ws.quantity = item.counted_qty
            db.flush()
            after = ws.quantity

            record_ledger(
                db, item.product_id, cc.warehouse_id,
                "adjustment", item.variance, before, after,
                description=f"Cycle Count #{cycle_count_id} adjustment: sys={item.system_qty} count={item.counted_qty}",
                reference_type="cycle_count", reference_id=cycle_count_id,
                created_by=created_by,
            )
            update_product_total_stock(db, item.product_id)

    cc.status = "completed"
    db.commit()
    db.refresh(cc)
    return cc

# ── Closing Stock ───────────────────────────────────────────────────────────

def calculate_daily_closing(db: Session, target_date: datetime = None):
    if target_date is None:
        target_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    next_date = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)

    warehouses = db.query(Warehouse).all()
    products = db.query(Product).all()

    for wh in warehouses:
        for prod in products:
            ws = get_warehouse_stock(db, wh.id, prod.id)
            if not ws:
                continue

            prev = db.query(ClosingStock).filter(
                ClosingStock.product_id == prod.id,
                ClosingStock.warehouse_id == wh.id,
                ClosingStock.date < target_date,
            ).order_by(ClosingStock.date.desc()).first()

            if prev:
                opening = prev.closing_qty
            else:
                opening = ws.quantity

            inward = db.query(sqlfunc.coalesce(sqlfunc.sum(StockLedger.quantity), 0)).filter(
                StockLedger.product_id == prod.id,
                StockLedger.warehouse_id == wh.id,
                StockLedger.transaction_type.in_(["stock_in", "transfer_in", "opening"]),
                StockLedger.created_at >= target_date,
                StockLedger.created_at <= next_date,
            ).scalar()

            outward = db.query(sqlfunc.coalesce(sqlfunc.sum(StockLedger.quantity), 0)).filter(
                StockLedger.product_id == prod.id,
                StockLedger.warehouse_id == wh.id,
                StockLedger.transaction_type.in_(["stock_out", "transfer_out", "return", "damage", "sale"]),
                StockLedger.created_at >= target_date,
                StockLedger.created_at <= next_date,
            ).scalar()

            closing = opening + int(inward) + int(outward)

            existing = db.query(ClosingStock).filter(
                ClosingStock.product_id == prod.id,
                ClosingStock.warehouse_id == wh.id,
                sqlfunc.date(ClosingStock.date) == target_date.date(),
            ).first()

            if existing:
                existing.opening_qty = opening
                existing.inward_qty = int(inward)
                existing.outward_qty = abs(int(outward))
                existing.closing_qty = closing
            else:
                db.add(ClosingStock(
                    product_id=prod.id, warehouse_id=wh.id,
                    date=target_date,
                    opening_qty=opening, inward_qty=int(inward),
                    outward_qty=abs(int(outward)), closing_qty=closing,
                ))

    db.commit()

# ── Reports ─────────────────────────────────────────────────────────────────

def get_warehouse_summary(db: Session):
    warehouses = db.query(Warehouse).all()
    result = []
    for wh in warehouses:
        total_items = db.query(sqlfunc.count(WarehouseStock.id)).filter(
            WarehouseStock.warehouse_id == wh.id,
        ).scalar()
        total_qty = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseStock.quantity), 0)).filter(
            WarehouseStock.warehouse_id == wh.id,
        ).scalar()
        result.append({
            "id": wh.id, "name": wh.name, "code": wh.code,
            "total_products": total_items, "total_quantity": int(total_qty),
        })
    return result


def get_stock_summary(db: Session, warehouse_id: int = None):
    query = db.query(
        WarehouseStock, Product.name, Product.sku, Warehouse.name.label("warehouse_name"),
    ).join(Product).join(Warehouse)

    if warehouse_id:
        query = query.filter(WarehouseStock.warehouse_id == warehouse_id)

    results = []
    for ws, pname, psku, whname in query.all():
        results.append({
            "id": ws.id,
            "product_id": ws.product_id,
            "product_name": pname,
            "sku": psku,
            "warehouse_id": ws.warehouse_id,
            "warehouse_name": whname,
            "quantity": ws.quantity,
            "reorder_level": ws.reorder_level,
            "low_stock": ws.quantity <= ws.reorder_level if ws.reorder_level > 0 else False,
        })
    return results


def get_stock_ledger_legacy(db: Session, product_id: int = None, warehouse_id: int = None, limit: int = 500):
    query = db.query(StockLedger)
    if product_id:
        query = query.filter(StockLedger.product_id == product_id)
    if warehouse_id:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    return query.order_by(StockLedger.created_at.desc()).limit(limit).all()


def get_low_stock_items(db: Session):
    return db.query(WarehouseStock).filter(
        WarehouseStock.reorder_level > 0,
        WarehouseStock.quantity <= WarehouseStock.reorder_level,
    ).all()


def get_all_transactions(db: Session, transaction_type: str = None, limit: int = 100):
    query = db.query(StockTransaction).order_by(StockTransaction.created_at.desc())
    if transaction_type:
        query = query.filter(StockTransaction.transaction_type == transaction_type)
    return query.limit(limit).all()


def get_damage_reports(db: Session, warehouse_id: int = None):
    query = db.query(DamageInventory)
    if warehouse_id:
        query = query.filter(DamageInventory.warehouse_id == warehouse_id)
    return query.order_by(DamageInventory.created_at.desc()).all()


# ══════════════════════════════════════════════════════════════════════════════
# NEW REBUILD SERVICES
# ══════════════════════════════════════════════════════════════════════════════

# ── COA Mode ────────────────────────────────────────────────────────────────

def get_coa_setting(db: Session, warehouse_id: int) -> COASetting:
    setting = db.query(COASetting).filter(COASetting.warehouse_id == warehouse_id).first()
    if not setting:
        raise ValueError("COA setting not found")
    return setting


def update_coa_setting(db: Session, warehouse_id: int, mode: str, linked_accounts: str = None) -> COASetting:
    setting = db.query(COASetting).filter(COASetting.warehouse_id == warehouse_id).first()
    if not setting:
        setting = COASetting(warehouse_id=warehouse_id, mode=mode, linked_main_coa_accounts=linked_accounts)
        db.add(setting)
    else:
        setting.mode = mode
        setting.linked_main_coa_accounts = linked_accounts
    db.commit()
    db.refresh(setting)
    return setting

# ── Opening Stock (rebuild) ─────────────────────────────────────────────────

def set_opening_stock(db: Session, warehouse_id: int, items: list) -> list[OpeningStock]:
    wh = get_warehouse(db, warehouse_id)
    if not wh:
        raise ValueError("Warehouse not found")

    now = datetime.utcnow()
    created = []
    total_value = 0.0
    for it in items:
        product_id = it["product_id"]
        qty = int(it["qty"])
        rate = float(it.get("rate", 0))
        value = qty * rate
        total_value += value

        existing = db.query(OpeningStock).filter(
            OpeningStock.warehouse_id == warehouse_id,
            OpeningStock.product_id == product_id,
        ).first()
        if existing:
            existing.qty = qty
            existing.rate = rate
            existing.value = value
            existing.date = it.get("date", now)
            os_obj = existing
        else:
            os_obj = OpeningStock(
                warehouse_id=warehouse_id,
                product_id=product_id,
                qty=qty,
                rate=rate,
                value=value,
                date=it.get("date", now),
            )
            db.add(os_obj)

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        ws.quantity = qty
        update_product_total_stock(db, product_id)
        db.flush()
        created.append(os_obj)

    post_journal_opening_stock(db, warehouse_id, now, f"Opening-{warehouse_id}", total_value)

    db.commit()
    for o in created:
        db.refresh(o)
    return created


def get_opening_stock(db: Session, warehouse_id: int) -> list[OpeningStock]:
    return db.query(OpeningStock).filter(OpeningStock.warehouse_id == warehouse_id).all()


def lock_opening_stock(db: Session, warehouse_id: int):
    items = db.query(OpeningStock).filter(
        OpeningStock.warehouse_id == warehouse_id,
        OpeningStock.locked == 0,
    ).all()
    for it in items:
        it.locked = 1
    db.commit()
    return items

# ── Stock Movements ─────────────────────────────────────────────────────────

def _record_stock_movement(
    db: Session, warehouse_id: int, product_id: int,
    movement_type: str, qty: int, rate: float = 0,
    reference_id: int = None, reference_type: str = None,
    salesman_id: int = None, shop_id: int = None,
    supplier_id: int = None,
    from_warehouse_id: int = None, to_warehouse_id: int = None,
    notes: str = None, date: datetime = None,
) -> StockMovement:
    value = abs(qty) * rate
    mov = StockMovement(
        warehouse_id=warehouse_id,
        product_id=product_id,
        movement_type=movement_type,
        qty=qty,
        rate=rate if rate else None,
        value=value if value else None,
        reference_id=reference_id,
        reference_type=reference_type,
        salesman_id=salesman_id,
        shop_id=shop_id,
        supplier_id=supplier_id,
        from_warehouse_id=from_warehouse_id,
        to_warehouse_id=to_warehouse_id,
        notes=notes,
        date=date or datetime.utcnow(),
    )
    db.add(mov)
    db.flush()
    return mov


def _record_stock_ledger_entry(
    db: Session, product_id: int, warehouse_id: int,
    transaction_type: str, quantity: int,
    rate: float = None, value: float = None,
    reference_id: int = None, reference_type: str = None,
    notes: str = None, created_by: str = None,
):
    ws = ensure_warehouse_stock(db, warehouse_id, product_id)
    balance_before = ws.quantity
    ws.quantity += quantity
    db.flush()
    balance_after = ws.quantity

    entry = StockLedger(
        product_id=product_id,
        warehouse_id=warehouse_id,
        transaction_type=transaction_type,
        quantity=quantity,
        rate=rate,
        value=value,
        balance_before=balance_before,
        balance_after=balance_after,
        reference_id=reference_id,
        reference_type=reference_type,
        notes=notes,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()
    update_product_total_stock(db, product_id)
    return entry


def stock_in(db, payload: dict) -> list[StockMovement]:
    warehouse_id = payload["warehouse_id"]
    items = payload["items"]
    date = payload.get("date", datetime.utcnow())
    notes = payload.get("notes")
    supplier_id = payload.get("supplier_id")

    movements = []
    total_value = 0.0
    for it in items:
        product_id = it["product_id"]
        qty = abs(int(it["quantity"]))
        rate = float(it.get("rate", 0))
        value = qty * rate
        total_value += value

        mov = _record_stock_movement(
            db, warehouse_id, product_id,
            "stock_in", qty, rate,
            notes=notes, date=date, supplier_id=supplier_id,
        )
        _record_stock_ledger_entry(
            db, product_id, warehouse_id,
            "stock_in", qty, rate, value,
            reference_id=mov.id, reference_type="stock_movement",
            notes=f"Stock In: {notes or ''}",
        )
        movements.append(mov)

    supplier_name = ""
    if supplier_id:
        from backend.models.supplier import Supplier
        sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if sup:
            supplier_name = sup.name

    post_journal_stock_in(db, warehouse_id, date, notes or f"StockIn-{len(movements)}", total_value, supplier_name)

    db.commit()
    for m in movements:
        db.refresh(m)
    return movements


def stock_out(db, payload: dict) -> list[StockMovement]:
    warehouse_id = payload["warehouse_id"]
    items = payload["items"]
    date = payload.get("date", datetime.utcnow())
    notes = payload.get("notes")
    salesman_id = payload.get("salesman_id")
    shop_id = payload.get("shop_id")

    movements = []
    for it in items:
        product_id = it["product_id"]
        qty = abs(int(it["quantity"]))
        rate = float(it.get("rate", 0))

        ws = get_warehouse_stock(db, warehouse_id, product_id)
        if not ws or ws.quantity < qty:
            raise ValueError(f"Insufficient stock for product #{product_id}")

        mov = _record_stock_movement(
            db, warehouse_id, product_id,
            "stock_out", -qty, rate,
            notes=notes, date=date,
            salesman_id=salesman_id, shop_id=shop_id,
        )
        _record_stock_ledger_entry(
            db, product_id, warehouse_id,
            "stock_out", -qty, rate, qty * rate,
            reference_id=mov.id, reference_type="stock_movement",
            notes=f"Stock Out: {notes or ''}",
        )
        movements.append(mov)

    db.commit()
    for m in movements:
        db.refresh(m)
    return movements


def transfer_stock(db, payload: dict) -> dict:
    source = payload["source_warehouse_id"]
    dest = payload["dest_warehouse_id"]
    items = payload["items"]
    date = payload.get("date", datetime.utcnow())
    notes = payload.get("notes")

    if source == dest:
        raise ValueError("Source and destination warehouses must be different")

    out_movements = []
    in_movements = []
    total_value = 0.0

    for it in items:
        product_id = it["product_id"]
        qty = abs(int(it["quantity"]))
        rate = float(it.get("rate", 0))
        value = qty * rate
        total_value += value

        ws = get_warehouse_stock(db, source, product_id)
        if not ws or ws.quantity < qty:
            raise ValueError(f"Insufficient stock in source for product #{product_id}")

        mov_out = _record_stock_movement(
            db, source, product_id,
            "transfer_out", -qty, rate,
            notes=notes, date=date,
            to_warehouse_id=dest,
        )
        _record_stock_ledger_entry(
            db, product_id, source,
            "transfer_out", -qty, rate, value,
            reference_id=mov_out.id, reference_type="stock_movement",
            notes=f"Transfer Out to #{dest}: {notes or ''}",
        )
        out_movements.append(mov_out)

        mov_in = _record_stock_movement(
            db, dest, product_id,
            "transfer_in", qty, rate,
            notes=notes, date=date,
            from_warehouse_id=source,
        )
        _record_stock_ledger_entry(
            db, product_id, dest,
            "transfer_in", qty, rate, value,
            reference_id=mov_in.id, reference_type="stock_movement",
            notes=f"Transfer In from #{source}: {notes or ''}",
        )
        in_movements.append(mov_in)

    ref = notes or f"Transfer-{source}-{dest}"
    post_journal_transfer_out(db, source, date, ref, total_value)
    post_journal_transfer_in(db, dest, date, ref, total_value)

    db.commit()
    for m in out_movements + in_movements:
        db.refresh(m)
    return {"out": out_movements, "in": in_movements}


def report_damage(db, payload: dict) -> StockMovement:
    warehouse_id = payload["warehouse_id"]
    product_id = payload["product_id"]
    qty = abs(int(payload["quantity"]))
    reason = payload.get("reason")
    date = payload.get("date", datetime.utcnow())

    ws = get_warehouse_stock(db, warehouse_id, product_id)
    if not ws or ws.quantity < qty:
        raise ValueError(f"Insufficient stock: have {ws.quantity if ws else 0}, damage {qty}")

    mov = _record_stock_movement(
        db, warehouse_id, product_id,
        "damage", -qty, 0,
        notes=reason, date=date,
    )
    last_cost = db.query(StockLedger.rate).filter(
        StockLedger.warehouse_id == warehouse_id,
        StockLedger.product_id == product_id,
        StockLedger.rate.isnot(None),
    ).order_by(StockLedger.created_at.desc()).first()
    damage_value = qty * (last_cost[0] if last_cost else 0)
    _record_stock_ledger_entry(
        db, product_id, warehouse_id,
        "damage", -qty, 0, damage_value,
        reference_id=mov.id, reference_type="stock_movement",
        notes=f"Damaged: {reason or 'No reason'}",

    )
    post_journal_damage(db, warehouse_id, date, f"Damage-{mov.id}", damage_value)
    db.commit()
    db.refresh(mov)
    return mov


def adjust_stock(db, payload: dict) -> list[StockMovement]:
    warehouse_id = payload["warehouse_id"]
    items = payload["items"]
    date = payload.get("date", datetime.utcnow())
    notes = payload.get("notes")

    movements = []
    for it in items:
        product_id = it["product_id"]
        adjustment = int(it["quantity"])
        rate = float(it.get("rate", 0))

        ws = ensure_warehouse_stock(db, warehouse_id, product_id)
        if ws.quantity + adjustment < 0:
            raise ValueError(f"Adjustment would cause negative stock for product #{product_id}")

        mov = _record_stock_movement(
            db, warehouse_id, product_id,
            "adjustment", adjustment, rate,
            notes=notes, date=date,
        )
        adjusted_value = abs(adjustment) * rate
        _record_stock_ledger_entry(
            db, product_id, warehouse_id,
            "adjustment", adjustment, rate, adjusted_value,
            reference_id=mov.id, reference_type="stock_movement",
            notes=f"Adjustment: {notes or ''}",
        )
        movements.append(mov)

        ref = f"Adj-{mov.id}"
        if adjustment < 0:
            post_journal_adjustment_negative(db, warehouse_id, date, ref, adjusted_value)
        else:
            post_journal_adjustment_positive(db, warehouse_id, date, ref, adjusted_value)

    db.commit()
    for m in movements:
        db.refresh(m)
    return movements


def get_stock_movements(
    db: Session, warehouse_id: int = None,
    movement_type: str = None, product_id: int = None, limit: int = 100,
) -> list:
    query = db.query(StockMovement).order_by(StockMovement.date.desc())
    if warehouse_id:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    return query.limit(limit).all()


def get_stock_ledger(
    db: Session, warehouse_id: int = None,
    product_id: int = None, limit: int = 500,
) -> list:
    query = db.query(StockLedger).order_by(StockLedger.created_at.desc())
    if warehouse_id:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    if product_id:
        query = query.filter(StockLedger.product_id == product_id)
    return query.limit(limit).all()

# ── Returns ─────────────────────────────────────────────────────────────────

def create_return(db, payload: dict) -> Return:
    return_type = payload["return_type"]
    warehouse_id = payload["warehouse_id"]
    product_id = payload["product_id"]
    qty = abs(int(payload["qty"]))
    rate = payload.get("rate")
    reason = payload.get("reason")
    date = payload.get("date", datetime.utcnow())
    salesman_id = payload.get("salesman_id")
    shop_id = payload.get("shop_id")
    invoice_id = payload.get("invoice_id")

    ret = Return(
        return_type=return_type,
        warehouse_id=warehouse_id,
        salesman_id=salesman_id,
        shop_id=shop_id,
        invoice_id=invoice_id,
        product_id=product_id,
        qty=qty,
        rate=rate,
        reason=reason,
        date=date,
    )
    db.add(ret)
    db.flush()

    ws = ensure_warehouse_stock(db, warehouse_id, product_id)
    ws.quantity += qty
    db.flush()
    update_product_total_stock(db, product_id)

    _record_stock_ledger_entry(
        db, product_id, warehouse_id,
        f"return_{return_type}", qty, rate, qty * (rate or 0),
        reference_id=ret.id, reference_type="return",
        notes=f"Return ({return_type}): {reason or ''}",
    )

    return_value = qty * (rate or 0)
    last_cost = db.query(StockLedger.rate).filter(
        StockLedger.warehouse_id == warehouse_id,
        StockLedger.product_id == product_id,
        StockLedger.rate.isnot(None),
    ).order_by(StockLedger.created_at.desc()).first()
    cost_value = qty * (last_cost[0] if last_cost else 0)

    if return_type == "shop":
        post_journal_shop_return(db, warehouse_id, date, f"Return-{ret.id}", return_value, cost_value)
    elif return_type == "salesman":
        post_journal_salesman_return(db, warehouse_id, date, f"Return-{ret.id}", cost_value)

    db.commit()
    db.refresh(ret)
    return ret


def get_returns(db: Session, warehouse_id: int = None, return_type: str = None) -> list:
    query = db.query(Return).order_by(Return.date.desc())
    if warehouse_id:
        query = query.filter(Return.warehouse_id == warehouse_id)
    if return_type:
        query = query.filter(Return.return_type == return_type)
    return query.all()

# ── Salesman Warehouse ──────────────────────────────────────────────────────

def link_salesman(db: Session, salesman_id: int, warehouse_id: int, areas: str = None) -> SalesmanWarehouse:
    existing = db.query(SalesmanWarehouse).filter(
        SalesmanWarehouse.salesman_id == salesman_id,
        SalesmanWarehouse.warehouse_id == warehouse_id,
    ).first()
    if existing:
        existing.areas = areas
        existing.status = "active"
        link = existing
    else:
        link = SalesmanWarehouse(
            salesman_id=salesman_id,
            warehouse_id=warehouse_id,
            areas=areas,
        )
        db.add(link)
    db.commit()
    db.refresh(link)
    return link


def get_salesman_links(db: Session, warehouse_id: int = None) -> list:
    query = db.query(SalesmanWarehouse)
    if warehouse_id:
        query = query.filter(SalesmanWarehouse.warehouse_id == warehouse_id)
    return query.all()


def get_salesman_detail(db: Session, salesman_id: int) -> dict:
    from backend.models.employee import Employee
    salesman = db.query(Employee).filter(Employee.id == salesman_id).first()
    if not salesman:
        raise ValueError("Salesman not found")

    links = db.query(SalesmanWarehouse).filter(
        SalesmanWarehouse.salesman_id == salesman_id,
    ).all()

    areas = db.query(Area).filter(Area.salesman_id == salesman_id).all()

    shops = db.query(Shop).filter(Shop.salesman_id == salesman_id).all()

    deliveries = db.query(StockMovement).filter(
        StockMovement.salesman_id == salesman_id,
        StockMovement.movement_type == "stock_out",
    ).order_by(StockMovement.date.desc()).limit(50).all()

    collections = db.query(ShopPayment).filter(
        ShopPayment.salesman_id == salesman_id,
    ).order_by(ShopPayment.date.desc()).limit(50).all()

    outstanding = db.query(sqlfunc.coalesce(sqlfunc.sum(Invoice.balance_amount), 0)).filter(
        Invoice.salesman_id == salesman_id,
        Invoice.status.in_(["unpaid", "partial"]),
    ).scalar()

    issued_stock = db.query(sqlfunc.coalesce(sqlfunc.sum(StockMovement.qty), 0)).filter(
        StockMovement.salesman_id == salesman_id,
        StockMovement.movement_type == "stock_out",
    ).scalar()

    return {
        "id": salesman.id,
        "name": salesman.name,
        "phone": salesman.phone,
        "warehouse_links": [
            {"id": l.id, "warehouse_id": l.warehouse_id, "areas": l.areas, "status": l.status}
            for l in links
        ],
        "areas": [{"id": a.id, "name": a.name, "description": a.description} for a in areas],
        "shops": [{"id": s.id, "name": s.name, "phone": s.phone, "status": s.status} for s in shops],
        "deliveries_count": len(deliveries),
        "collections_count": len(collections),
        "outstanding": float(outstanding),
        "stock_issued": int(issued_stock),
    }

# ── Areas ───────────────────────────────────────────────────────────────────

def create_area(db, payload) -> Area:
    area = Area(
        name=payload.name,
        description=payload.description,
        salesman_id=payload.salesman_id,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


def get_areas(db: Session) -> list:
    return db.query(Area).order_by(Area.name).all()

# ── Shops CRUD ──────────────────────────────────────────────────────────────

def create_shop(db, payload) -> Shop:
    shop = Shop(
        name=payload.name,
        owner_name=payload.owner_name,
        phone=payload.phone,
        address=payload.address,
        area_id=payload.area_id,
        salesman_id=payload.salesman_id,
        credit_limit=payload.credit_limit,
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return shop


def update_shop(db: Session, shop_id: int, payload) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise ValueError("Shop not found")
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None and hasattr(shop, k):
            setattr(shop, k, v)
    db.commit()
    db.refresh(shop)
    return shop


def delete_shop(db: Session, shop_id: int):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise ValueError("Shop not found")
    db.delete(shop)
    db.commit()


def get_shop(db: Session, shop_id: int) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise ValueError("Shop not found")
    return shop


def get_shops(db: Session, area_id: int = None, salesman_id: int = None) -> list:
    query = db.query(Shop).order_by(Shop.name)
    if area_id:
        query = query.filter(Shop.area_id == area_id)
    if salesman_id:
        query = query.filter(Shop.salesman_id == salesman_id)
    return query.all()


def get_shop_detail(db: Session, shop_id: int) -> dict:
    shop = get_shop(db, shop_id)
    area_name = None
    if shop.area_id:
        area = db.query(Area).filter(Area.id == shop.area_id).first()
        area_name = area.name if area else None

    salesman_name = None
    if shop.salesman_id:
        from backend.models.employee import Employee
        salesman = db.query(Employee).filter(Employee.id == shop.salesman_id).first()
        salesman_name = salesman.name if salesman else None

    invoices = db.query(Invoice).filter(Invoice.shop_id == shop_id).order_by(Invoice.date.desc()).all()
    total_purchases = sum(i.net_total for i in invoices)
    total_paid = sum(i.paid_amount for i in invoices)
    outstanding = sum(i.balance_amount for i in invoices)

    payments = db.query(ShopPayment).filter(ShopPayment.shop_id == shop_id).order_by(ShopPayment.date.desc()).all()

    return {
        "id": shop.id,
        "name": shop.name,
        "owner_name": shop.owner_name,
        "phone": shop.phone,
        "address": shop.address,
        "area_id": shop.area_id,
        "area_name": area_name,
        "salesman_id": shop.salesman_id,
        "salesman_name": salesman_name,
        "credit_limit": shop.credit_limit,
        "status": shop.status,
        "created_at": shop.created_at,
        "updated_at": shop.updated_at,
        "total_purchases": total_purchases,
        "total_paid": total_paid,
        "outstanding": outstanding,
        "invoices": [
            {
                "id": inv.id,
                "invoice_no": inv.invoice_no,
                "date": inv.date,
                "gross_total": inv.gross_total,
                "discount": inv.discount,
                "net_total": inv.net_total,
                "paid_amount": inv.paid_amount,
                "balance_amount": inv.balance_amount,
                "status": inv.status,
            }
            for inv in invoices
        ],
        "payments": [
            {
                "id": p.id,
                "invoice_id": p.invoice_id,
                "date": p.date,
                "amount": p.amount,
                "payment_mode": p.payment_mode,
                "reference": p.reference,
                "notes": p.notes,
            }
            for p in payments
        ],
    }

# ── Invoices ────────────────────────────────────────────────────────────────

def create_invoice(db, payload: dict) -> Invoice:
    salesman_id = payload["salesman_id"]
    shop_id = payload["shop_id"]
    warehouse_id = payload["warehouse_id"]
    items_data = payload["items"]
    discount = float(payload.get("discount", 0))
    paid_amount = float(payload.get("paid_amount", 0))
    date = payload.get("date", datetime.utcnow())

    gross_total = 0.0
    total_cost = 0.0
    for it in items_data:
        product_id = it["product_id"]
        qty = int(it["qty"])
        rate = float(it.get("rate", 0))
        amount = qty * rate
        gross_total += amount

        ws = get_warehouse_stock(db, warehouse_id, product_id)
        if not ws or ws.quantity < qty:
            raise ValueError(f"Insufficient stock for product #{product_id} in warehouse #{warehouse_id}")
        last_cost = db.query(StockLedger.rate).filter(
            StockLedger.warehouse_id == warehouse_id,
            StockLedger.product_id == product_id,
            StockLedger.rate.isnot(None),
        ).order_by(StockLedger.created_at.desc()).first()
        cost_rate = last_cost[0] if last_cost else 0
        total_cost += qty * cost_rate
        items.append({
            "product_id": product_id,
            "qty": qty,
            "rate": rate,
            "amount": amount,
            "cost_rate": cost_rate,
        })

    net_total = gross_total - discount
    balance_amount = net_total - paid_amount

    if balance_amount <= 0:
        status = "paid"
    elif paid_amount > 0:
        status = "partial"
    else:
        status = "unpaid"

    invoice = Invoice(
        invoice_no=_next_invoice_no(db),
        date=date,
        salesman_id=salesman_id,
        shop_id=shop_id,
        warehouse_id=warehouse_id,
        gross_total=gross_total,
        discount=discount,
        net_total=net_total,
        paid_amount=paid_amount,
        balance_amount=max(balance_amount, 0),
        status=status,
    )
    db.add(invoice)
    db.flush()

    for it in items:
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            product_id=it["product_id"],
            qty=it["qty"],
            rate=it["rate"],
            amount=it["amount"],
        ))

        mov = _record_stock_movement(
            db, warehouse_id, it["product_id"],
            "stock_out", -it["qty"], it["rate"],
            reference_id=invoice.id, reference_type="invoice",
            salesman_id=salesman_id, shop_id=shop_id,
            notes=f"Invoice #{invoice.invoice_no}",
            date=date,
        )
        _record_stock_ledger_entry(
            db, it["product_id"], warehouse_id,
            "stock_out", -it["qty"], it["rate"], it["amount"],
            reference_id=mov.id, reference_type="invoice",
            notes=f"Invoice #{invoice.invoice_no}",
        )

    if paid_amount > 0:
        payment = ShopPayment(
            shop_id=shop_id,
            invoice_id=invoice.id,
            date=date,
            amount=paid_amount,
            payment_mode="cash",
            salesman_id=salesman_id,
            notes=f"Auto payment for invoice #{invoice.invoice_no}",
        )
        db.add(payment)

    post_journal_invoice(db, warehouse_id, date, invoice.invoice_no, net_total, discount, total_cost)
    if paid_amount > 0:
        post_journal_payment(db, warehouse_id, date, invoice.invoice_no, paid_amount)

    db.commit()
    db.refresh(invoice)
    return invoice


def get_invoice(db: Session, invoice_id: int) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise ValueError("Invoice not found")
    return inv


def get_invoices(
    db: Session, shop_id: int = None, salesman_id: int = None,
    warehouse_id: int = None, status: str = None, limit: int = 100,
) -> list:
    query = db.query(Invoice).order_by(Invoice.date.desc())
    if shop_id:
        query = query.filter(Invoice.shop_id == shop_id)
    if salesman_id:
        query = query.filter(Invoice.salesman_id == salesman_id)
    if warehouse_id:
        query = query.filter(Invoice.warehouse_id == warehouse_id)
    if status:
        query = query.filter(Invoice.status == status)
    return query.limit(limit).all()


def get_invoice_detail(db: Session, invoice_id: int) -> dict:
    inv = get_invoice(db, invoice_id)

    from backend.models.employee import Employee
    salesman = db.query(Employee).filter(Employee.id == inv.salesman_id).first()
    shop = db.query(Shop).filter(Shop.id == inv.shop_id).first()
    warehouse = db.query(Warehouse).filter(Warehouse.id == inv.warehouse_id).first()

    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).all()

    return {
        "id": inv.id,
        "invoice_no": inv.invoice_no,
        "date": inv.date,
        "salesman_id": inv.salesman_id,
        "salesman_name": salesman.name if salesman else None,
        "shop_id": inv.shop_id,
        "shop_name": shop.name if shop else None,
        "warehouse_id": inv.warehouse_id,
        "warehouse_name": warehouse.name if warehouse else None,
        "gross_total": inv.gross_total,
        "discount": inv.discount,
        "net_total": inv.net_total,
        "paid_amount": inv.paid_amount,
        "balance_amount": inv.balance_amount,
        "status": inv.status,
        "created_at": inv.created_at,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": db.query(Product.name).filter(Product.id == item.product_id).scalar(),
                "qty": item.qty,
                "rate": item.rate,
                "amount": item.amount,
            }
            for item in items
        ],
    }

# ── Payments ────────────────────────────────────────────────────────────────

def record_payment(db, payload: dict) -> ShopPayment:
    shop_id = payload["shop_id"]
    invoice_id = payload.get("invoice_id")
    amount = float(payload["amount"])
    payment_mode = payload.get("payment_mode", "cash")
    reference = payload.get("reference")
    notes = payload.get("notes")
    salesman_id = payload.get("salesman_id")
    date = payload.get("date", datetime.utcnow())

    payment = ShopPayment(
        shop_id=shop_id,
        invoice_id=invoice_id,
        date=date,
        amount=amount,
        payment_mode=payment_mode,
        reference=reference,
        notes=notes,
        salesman_id=salesman_id,
    )
    db.add(payment)
    db.flush()

    if invoice_id:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.paid_amount = (inv.paid_amount or 0) + amount
            inv.balance_amount = max(inv.net_total - inv.paid_amount, 0)
            if inv.balance_amount <= 0:
                inv.status = "paid"
            else:
                inv.status = "partial"
            db.flush()

            post_journal_payment(db, inv.warehouse_id, date,
                f"Payment-{invoice_id}", amount)

    db.commit()
    db.refresh(payment)
    return payment


def get_payments(
    db: Session, shop_id: int = None,
    salesman_id: int = None, invoice_id: int = None,
) -> list:
    query = db.query(ShopPayment).order_by(ShopPayment.date.desc())
    if shop_id:
        query = query.filter(ShopPayment.shop_id == shop_id)
    if salesman_id:
        query = query.filter(ShopPayment.salesman_id == salesman_id)
    if invoice_id:
        query = query.filter(ShopPayment.invoice_id == invoice_id)
    return query.all()


def get_daily_collection(db: Session, date: str = None, salesman_id: int = None) -> dict:
    target_date = datetime.strptime(date, "%Y-%m-%d") if date else datetime.utcnow()

    query = db.query(ShopPayment).filter(
        sqlfunc.date(ShopPayment.date) == target_date.date(),
    )
    if salesman_id:
        query = query.filter(ShopPayment.salesman_id == salesman_id)

    payments = query.all()
    total = sum(p.amount for p in payments)
    count = len(payments)

    by_mode = {}
    for p in payments:
        by_mode[p.payment_mode] = by_mode.get(p.payment_mode, 0) + p.amount

    return {
        "date": target_date.date().isoformat(),
        "total_collection": total,
        "payment_count": count,
        "by_mode": by_mode,
        "payments": [
            {
                "id": p.id,
                "shop_id": p.shop_id,
                "invoice_id": p.invoice_id,
                "amount": p.amount,
                "payment_mode": p.payment_mode,
                "reference": p.reference,
                "salesman_id": p.salesman_id,
                "date": p.date,
            }
            for p in payments
        ],
    }

# ── Dashboard ───────────────────────────────────────────────────────────────

def get_dashboard_stats(db: Session) -> dict:
    total_warehouses = db.query(sqlfunc.count(Warehouse.id)).scalar()
    total_products = db.query(sqlfunc.count(Product.id)).scalar()
    stock_value = db.query(
        sqlfunc.coalesce(sqlfunc.sum(WarehouseStock.quantity * Product.cost_price), 0),
    ).join(Product).filter(WarehouseStock.quantity > 0).scalar()
    today = datetime.utcnow().date()
    today_deliveries = db.query(sqlfunc.count(StockMovement.id)).filter(
        StockMovement.movement_type == "stock_out",
        sqlfunc.date(StockMovement.date) == today,
    ).scalar()
    today_collections = db.query(sqlfunc.coalesce(sqlfunc.sum(ShopPayment.amount), 0)).filter(
        sqlfunc.date(ShopPayment.date) == today,
    ).scalar()
    outstanding = db.query(sqlfunc.coalesce(sqlfunc.sum(Invoice.balance_amount), 0)).filter(
        Invoice.status.in_(["unpaid", "partial"]),
    ).scalar()
    low_stock = db.query(sqlfunc.count(WarehouseStock.id)).filter(
        WarehouseStock.reorder_level > 0,
        WarehouseStock.quantity <= WarehouseStock.reorder_level,
    ).scalar()
    total_shops = db.query(sqlfunc.count(Shop.id)).scalar()
    total_salesmen = db.query(
        sqlfunc.count(sqlfunc.distinct(SalesmanWarehouse.salesman_id)),
    ).scalar()

    return {
        "total_warehouses": int(total_warehouses),
        "total_products": int(total_products),
        "total_stock_value": float(stock_value),
        "today_deliveries": int(today_deliveries),
        "today_collections": float(today_collections),
        "outstanding_collections": float(outstanding),
        "low_stock_alerts": int(low_stock),
        "total_shops": int(total_shops),
        "total_salesmen": int(total_salesmen),
    }

# ── Reports ─────────────────────────────────────────────────────────────────

def get_stock_valuation_report(db: Session, warehouse_id: int = None) -> list:
    query = db.query(
        WarehouseStock, Product.name, Product.sku, Product.cost_price,
    ).join(Product)
    if warehouse_id:
        query = query.filter(WarehouseStock.warehouse_id == warehouse_id)
    results = []
    for ws, pname, psku, cost in query.all():
        valuation = ws.quantity * (cost or 0)
        results.append({
            "product_id": ws.product_id,
            "product_name": pname,
            "sku": psku,
            "warehouse_id": ws.warehouse_id,
            "quantity": ws.quantity,
            "cost_price": cost or 0,
            "valuation": valuation,
        })
    return results


def get_low_stock_report(db: Session) -> list:
    items = db.query(WarehouseStock).filter(
        WarehouseStock.reorder_level > 0,
        WarehouseStock.quantity <= WarehouseStock.reorder_level,
    ).all()
    results = []
    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        results.append({
            "product_id": item.product_id,
            "product_name": product.name if product else None,
            "sku": product.sku if product else None,
            "warehouse_id": item.warehouse_id,
            "quantity": item.quantity,
            "reorder_level": item.reorder_level,
        })
    return results


def get_stock_movement_report(
    db: Session, warehouse_id: int, start_date: str, end_date: str,
) -> list:
    start = datetime.strptime(start_date, "%Y-%m-%d") if isinstance(start_date, str) else start_date
    end = datetime.strptime(end_date, "%Y-%m-%d") if isinstance(end_date, str) else end_date

    movements = db.query(StockMovement).filter(
        StockMovement.warehouse_id == warehouse_id,
        StockMovement.date >= start,
        StockMovement.date <= end,
    ).order_by(StockMovement.date.desc()).all()

    results = []
    for m in movements:
        product = db.query(Product.name, Product.sku).filter(Product.id == m.product_id).first()
        results.append({
            "id": m.id,
            "date": m.date,
            "product_id": m.product_id,
            "product_name": product.name if product else None,
            "sku": product.sku if product else None,
            "movement_type": m.movement_type,
            "qty": m.qty,
            "rate": m.rate,
            "value": m.value,
            "notes": m.notes,
        })
    return results


def get_damage_report(db: Session, warehouse_id: int = None) -> list:
    query = db.query(StockMovement).filter(StockMovement.movement_type == "damage")
    if warehouse_id:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)
    items = query.order_by(StockMovement.date.desc()).all()
    results = []
    for m in items:
        product = db.query(Product.name, Product.sku).filter(Product.id == m.product_id).first()
        results.append({
            "id": m.id,
            "date": m.date,
            "product_id": m.product_id,
            "product_name": product.name if product else None,
            "sku": product.sku if product else None,
            "warehouse_id": m.warehouse_id,
            "qty": abs(m.qty),
            "notes": m.notes,
        })
    return results


def get_return_report(db: Session, warehouse_id: int = None, return_type: str = None) -> list:
    query = db.query(Return).order_by(Return.date.desc())
    if warehouse_id:
        query = query.filter(Return.warehouse_id == warehouse_id)
    if return_type:
        query = query.filter(Return.return_type == return_type)
    results = []
    for r in query.all():
        product = db.query(Product.name, Product.sku).filter(Product.id == r.product_id).first()
        results.append({
            "id": r.id,
            "date": r.date,
            "return_type": r.return_type,
            "product_id": r.product_id,
            "product_name": product.name if product else None,
            "sku": product.sku if product else None,
            "warehouse_id": r.warehouse_id,
            "salesman_id": r.salesman_id,
            "shop_id": r.shop_id,
            "qty": r.qty,
            "rate": r.rate,
            "reason": r.reason,
        })
    return results


def get_salesman_performance(db: Session) -> list:
    from backend.models.employee import Employee
    salesmen = db.query(SalesmanWarehouse.salesman_id).distinct().all()
    results = []
    for (sid,) in salesmen:
        emp = db.query(Employee).filter(Employee.id == sid).first()
        if not emp:
            continue
        total_deliveries = db.query(sqlfunc.count(StockMovement.id)).filter(
            StockMovement.salesman_id == sid,
            StockMovement.movement_type == "stock_out",
        ).scalar()
        total_collections = db.query(sqlfunc.coalesce(sqlfunc.sum(ShopPayment.amount), 0)).filter(
            ShopPayment.salesman_id == sid,
        ).scalar()
        outstanding = db.query(sqlfunc.coalesce(sqlfunc.sum(Invoice.balance_amount), 0)).filter(
            Invoice.salesman_id == sid,
            Invoice.status.in_(["unpaid", "partial"]),
        ).scalar()
        shop_count = db.query(sqlfunc.count(Shop.id)).filter(Shop.salesman_id == sid).scalar()
        results.append({
            "salesman_id": sid,
            "salesman_name": emp.name,
            "phone": emp.phone,
            "total_deliveries": int(total_deliveries),
            "total_collections": float(total_collections),
            "outstanding": float(outstanding),
            "shop_count": int(shop_count),
        })
    return results


def get_shop_outstanding_report(db: Session) -> list:
    shops = db.query(Shop).filter(Shop.status == "active").all()
    results = []
    for shop in shops:
        outstanding = db.query(sqlfunc.coalesce(sqlfunc.sum(Invoice.balance_amount), 0)).filter(
            Invoice.shop_id == shop.id,
            Invoice.status.in_(["unpaid", "partial"]),
        ).scalar()
        if outstanding > 0:
            results.append({
                "shop_id": shop.id,
                "shop_name": shop.name,
                "owner_name": shop.owner_name,
                "phone": shop.phone,
                "credit_limit": shop.credit_limit,
                "outstanding": float(outstanding),
            })
    return results


def get_outstanding_aging_report(db: Session, days: int = 30) -> list:
    cutoff = datetime.utcnow()
    invoices = db.query(Invoice).filter(
        Invoice.status.in_(["unpaid", "partial"]),
    ).all()
    results = []
    for inv in invoices:
        age = (cutoff - inv.date).days if inv.date else 0
        shop = db.query(Shop.name, Shop.phone).filter(Shop.id == inv.shop_id).first()
        bucket = "0-30" if age <= 30 else "31-60" if age <= 60 else "61-90" if age <= 90 else "90+"
        if days == 30 and age > 30:
            continue
        results.append({
            "invoice_id": inv.id,
            "invoice_no": inv.invoice_no,
            "date": inv.date,
            "shop_id": inv.shop_id,
            "shop_name": shop.name if shop else None,
            "shop_phone": shop.phone if shop else None,
            "age_days": age,
            "bucket": bucket,
            "balance_amount": inv.balance_amount,
        })
    return results


def get_profit_loss_summary(db: Session, start_date: str, end_date: str) -> dict:
    start = datetime.strptime(start_date, "%Y-%m-%d") if isinstance(start_date, str) else start_date
    end = datetime.strptime(end_date, "%Y-%m-%d") if isinstance(end_date, str) else end_date

    total_sales = db.query(sqlfunc.coalesce(sqlfunc.sum(Invoice.net_total), 0)).filter(
        Invoice.date >= start,
        Invoice.date <= end,
    ).scalar()

    total_cost = 0
    invoice_items = db.query(InvoiceItem).join(Invoice).filter(
        Invoice.date >= start,
        Invoice.date <= end,
    ).all()
    for item in invoice_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            total_cost += item.qty * (product.cost_price or 0)

    total_collections = db.query(sqlfunc.coalesce(sqlfunc.sum(ShopPayment.amount), 0)).filter(
        ShopPayment.date >= start,
        ShopPayment.date <= end,
    ).scalar()

    gross_profit = float(total_sales) - float(total_cost)
    margin = (gross_profit / float(total_sales) * 100) if float(total_sales) > 0 else 0

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_sales": float(total_sales),
        "total_cost": float(total_cost),
        "gross_profit": gross_profit,
        "profit_margin_percent": round(margin, 2),
        "total_collections": float(total_collections),
        "invoice_count": len(invoice_items),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# COA — Chart of Accounts & Auto-Journal
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_ACCOUNTS = [
    # (code, name, type, description)
    ("1001", "Inventory Account",             "Asset",     "Stock value of all products in warehouse"),
    ("1002", "Accounts Receivable — Shops",   "Asset",     "Udhar from shops (invoice outstanding)"),
    ("1003", "Cash in Hand",                  "Asset",     "Cash collected from shops"),
    ("1004", "Stock in Transit",              "Asset",     "Transfer between warehouses"),
    ("1005", "Opening Stock Account",         "Asset",     "Initial stock value"),
    ("2001", "Accounts Payable — Suppliers",  "Liability",  "Hum ne lena ha supplier se"),
    ("2002", "Salesman Payable",              "Liability",  "Salesman ka hisab"),
    ("3001", "Warehouse Capital Account",     "Equity",    "Separate mode only"),
    ("3002", "Retained Earnings",             "Equity",    "Profit rakhna"),
    ("4001", "Sales Revenue",                 "Income",    "Invoice total"),
    ("4002", "Sales Returns",                 "Income",    "Contra — shop returns"),
    ("4003", "Discount Allowed",              "Income",    "Contra — discount diya"),
    ("5001", "Cost of Goods Sold (COGS)",     "Expense",   "Stock cost"),
    ("5002", "Damage & Loss Account",         "Expense",   "Kharab maal"),
    ("5003", "Salesman Return — Loss",        "Expense",   "Wapas aaya maal"),
    ("5004", "Inventory Adjustment Loss",     "Expense",   "Negative adjustments"),
    ("5005", "Stock Written Off",             "Expense",   "Expired/total loss"),
]


def seed_warehouse_coa(db: Session, warehouse_id: int):
    existing = db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id
    ).count()
    if existing > 0:
        return
    for code, name, atype, desc in SYSTEM_ACCOUNTS:
        db.add(WarehouseCOAAccount(
            warehouse_id=warehouse_id,
            account_code=code,
            account_name=name,
            account_type=atype,
            description=desc,
            is_system=1,
        ))
    db.commit()


def _get_coa_account(db: Session, warehouse_id: int, account_code: str):
    return db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
        WarehouseCOAAccount.account_code == account_code,
    ).first()


def _get_coa_account_by_name(db: Session, warehouse_id: int, account_name: str):
    return db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
        WarehouseCOAAccount.account_name == account_name,
    ).first()


def _post_journal_entry(
    db: Session, warehouse_id: int,
    date: datetime, reference: str, narration: str,
    lines: list,
):
    entry = WarehouseJournalEntry(
        warehouse_id=warehouse_id,
        date=date,
        reference=reference,
        narration=narration,
    )
    db.add(entry)
    db.flush()
    for acct_code_or_id, debit, credit in lines:
        if isinstance(acct_code_or_id, str):
            acct = _get_coa_account(db, warehouse_id, acct_code_or_id)
        else:
            acct = db.query(WarehouseCOAAccount).filter(
                WarehouseCOAAccount.id == acct_code_or_id,
                WarehouseCOAAccount.warehouse_id == warehouse_id,
            ).first()
        if not acct:
            continue
        db.add(WarehouseJournalLine(
            journal_id=entry.id,
            account_id=acct.id,
            debit=debit,
            credit=credit,
        ))
    db.flush()
    return entry


def _get_stock_value(db: Session, warehouse_id: int, product_id: int) -> float:
    ws = get_warehouse_stock(db, warehouse_id, product_id)
    if not ws:
        return 0
    last = db.query(StockLedger).filter(
        StockLedger.warehouse_id == warehouse_id,
        StockLedger.product_id == product_id,
        StockLedger.rate.isnot(None),
    ).order_by(StockLedger.created_at.desc()).first()
    return (last.rate or 0) * ws.quantity if last else 0


# ── Auto-journal posting ─────────────────────────────────────────────────


def post_journal_stock_in(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, items_total_value: float, supplier_name: str = "",
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Stock In from {supplier_name or 'Supplier'} ({reference})",
        [
            ("1001", items_total_value, 0),   # Dr Inventory
            ("2001", 0, items_total_value),    # Cr Accounts Payable
        ],
    )


def post_journal_invoice(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, net_total: float, discount: float,
    total_cost: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Invoice {reference}",
        [
            ("1002", net_total, 0),            # Dr Accounts Receivable
            ("4001", 0, net_total),            # Cr Sales Revenue
        ],
    )
    if discount > 0:
        _post_journal_entry(db, warehouse_id, date, reference,
            f"Discount on {reference}",
            [
                ("4003", discount, 0),         # Dr Discount Allowed
                ("1002", 0, discount),          # Cr Accounts Receivable
            ],
        )
    _post_journal_entry(db, warehouse_id, date, reference,
        f"COGS for {reference}",
        [
            ("5001", total_cost, 0),           # Dr COGS
            ("1001", 0, total_cost),            # Cr Inventory
        ],
    )


def post_journal_payment(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, amount: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Payment received {reference}",
        [
            ("1003", amount, 0),               # Dr Cash in Hand
            ("1002", 0, amount),                # Cr Accounts Receivable
        ],
    )


def post_journal_damage(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, damage_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Damage entry {reference}",
        [
            ("5002", damage_value, 0),         # Dr Damage & Loss
            ("1001", 0, damage_value),          # Cr Inventory
        ],
    )


def post_journal_shop_return(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, return_value: float, cost_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Shop return {reference}",
        [
            ("4002", return_value, 0),         # Dr Sales Returns
            ("1002", 0, return_value),          # Cr Accounts Receivable
        ],
    )
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Shop return inventory {reference}",
        [
            ("1001", cost_value, 0),           # Dr Inventory
            ("5001", 0, cost_value),            # Cr COGS
        ],
    )


def post_journal_salesman_return(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, stock_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Salesman return {reference}",
        [
            ("1001", stock_value, 0),          # Dr Inventory
            ("5003", 0, stock_value),           # Cr Salesman Return Loss
        ],
    )


def post_journal_transfer_out(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, transfer_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Stock transfer OUT {reference}",
        [
            ("1004", transfer_value, 0),       # Dr Stock in Transit
            ("1001", 0, transfer_value),        # Cr Inventory
        ],
    )


def post_journal_transfer_in(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, transfer_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Stock transfer IN {reference}",
        [
            ("1001", transfer_value, 0),       # Dr Inventory
            ("1004", 0, transfer_value),        # Cr Stock in Transit
        ],
    )


def post_journal_adjustment_negative(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, adjusted_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Negative adjustment {reference}",
        [
            ("5004", adjusted_value, 0),       # Dr Inventory Adjustment Loss
            ("1001", 0, adjusted_value),        # Cr Inventory
        ],
    )


def post_journal_adjustment_positive(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, adjusted_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Positive adjustment {reference}",
        [
            ("1001", adjusted_value, 0),       # Dr Inventory
            ("3001", 0, adjusted_value),        # Cr Warehouse Capital Account
        ],
    )


def post_journal_opening_stock(
    db: Session, warehouse_id: int, date: datetime,
    reference: str, total_value: float,
):
    _post_journal_entry(db, warehouse_id, date, reference,
        f"Opening stock set {reference}",
        [
            ("1005", total_value, 0),          # Dr Opening Stock Account
            ("3001", 0, total_value),           # Cr Warehouse Capital Account
        ],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# COA Query endpoints
# ═══════════════════════════════════════════════════════════════════════════════

def get_coa_accounts(db: Session, warehouse_id: int) -> list:
    return db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
    ).order_by(WarehouseCOAAccount.account_code).all()


def get_coa_account_detail(db: Session, account_id: int) -> dict:
    acct = db.query(WarehouseCOAAccount).filter(WarehouseCOAAccount.id == account_id).first()
    if not acct:
        return None
    total_dr = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseJournalLine.debit), 0)).filter(
        WarehouseJournalLine.account_id == account_id,
    ).scalar()
    total_cr = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseJournalLine.credit), 0)).filter(
        WarehouseJournalLine.account_id == account_id,
    ).scalar()
    lines = db.query(WarehouseJournalLine).join(WarehouseJournalEntry).filter(
        WarehouseJournalLine.account_id == account_id,
    ).order_by(WarehouseJournalEntry.date.desc()).all()
    balance = total_dr - total_cr
    return {
        "account": acct,
        "total_debits": float(total_dr),
        "total_credits": float(total_cr),
        "balance": float(balance),
        "lines": lines,
    }


def get_journal_entries(
    db: Session, warehouse_id: int = None,
    account_id: int = None,
    start_date: str = None, end_date: str = None,
    limit: int = 200,
) -> list:
    query = db.query(WarehouseJournalEntry).order_by(WarehouseJournalEntry.date.desc())
    if warehouse_id:
        query = query.filter(WarehouseJournalEntry.warehouse_id == warehouse_id)
    if account_id:
        query = query.join(WarehouseJournalLine).filter(
            WarehouseJournalLine.account_id == account_id,
        )
    if start_date:
        query = query.filter(WarehouseJournalEntry.date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(WarehouseJournalEntry.date <= datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
    return query.limit(limit).all()


def get_trial_balance(db: Session, warehouse_id: int) -> list:
    accounts = db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
    ).all()
    result = []
    for acct in accounts:
        total_dr = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseJournalLine.debit), 0)).filter(
            WarehouseJournalLine.account_id == acct.id,
        ).scalar()
        total_cr = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseJournalLine.credit), 0)).filter(
            WarehouseJournalLine.account_id == acct.id,
        ).scalar()
        balance = float(total_dr - total_cr)
        result.append({
            "account_id": acct.id,
            "account_code": acct.account_code,
            "account_name": acct.account_name,
            "account_type": acct.account_type,
            "is_system": acct.is_system,
            "debit": float(total_dr),
            "credit": float(total_cr),
            "balance": balance,
        })
    return result


def create_custom_coa_account(db: Session, warehouse_id: int, payload) -> WarehouseCOAAccount:
    existing_code = db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
        WarehouseCOAAccount.account_code == payload.account_code,
    ).first()
    if existing_code:
        raise ValueError(f"Account code {payload.account_code} already exists")

    existing_name = db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
        WarehouseCOAAccount.account_name == payload.account_name,
    ).first()
    if existing_name:
        raise ValueError(f"Account name {payload.account_name} already exists")

    acct = WarehouseCOAAccount(
        warehouse_id=warehouse_id,
        account_code=payload.account_code,
        account_name=payload.account_name,
        account_type=payload.account_type,
        description=payload.description,
        is_system=0,
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct


def delete_coa_account(db: Session, account_id: int):
    acct = db.query(WarehouseCOAAccount).filter(WarehouseCOAAccount.id == account_id).first()
    if not acct:
        raise ValueError("Account not found")
    if acct.is_system:
        raise ValueError("Cannot delete system account")
    entry_count = db.query(WarehouseJournalLine).filter(
        WarehouseJournalLine.account_id == account_id,
    ).count()
    if entry_count > 0:
        raise ValueError("Cannot delete account with journal entries")
    db.delete(acct)
    db.commit()
