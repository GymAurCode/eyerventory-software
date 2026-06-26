from datetime import datetime

from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.warehouse import (
    ClosingStock,
    CycleCount,
    CycleCountItem,
    DamageInventory,
    StockLedger,
    StockTransaction,
    StockTransactionItem,
    Warehouse,
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
        unit_price=unit_price, total_amount=total_amount,
        description=description, reference_type=reference_type, reference_id=reference_id,
        created_by=created_by,
    ))

# ── Stock In (Supplier Receipt) ─────────────────────────────────────────────

def stock_in(
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

def stock_out(
    db: Session, warehouse_id: int, items: list[dict],
    reference_no: str = None, notes: str = None, created_by: str = None,
    allow_negative: bool = False,
):
    # Validate stock availability
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

def transfer(
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

        # Remove from source
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

        # Add to destination
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

def adjust_stock(
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

def report_damage(
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

def set_opening_stock(
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

            # Opening = previous closing or current stock
            prev = db.query(ClosingStock).filter(
                ClosingStock.product_id == prod.id,
                ClosingStock.warehouse_id == wh.id,
                ClosingStock.date < target_date,
            ).order_by(ClosingStock.date.desc()).first()

            if prev:
                opening = prev.closing_qty
            else:
                opening = ws.quantity

            # Calculate movements on target date
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
                func.date(ClosingStock.date) == target_date.date(),
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


def get_stock_ledger(db: Session, product_id: int = None, warehouse_id: int = None, limit: int = 500):
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
