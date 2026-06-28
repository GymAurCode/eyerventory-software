from datetime import datetime, timedelta

from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.warehouse import (
    Invoice, InvoiceItem, OpeningStock, Return, Shop, ShopPayment,
    StockLedger, StockMovement, Warehouse, WarehouseCOAAccount,
    WarehouseJournalEntry, WarehouseJournalLine, WarehouseStock,
)
from backend.services.warehouse_service import get_warehouse_stock


# ── Helpers ────────────────────────────────────────────────────────────────

def _q(val):
    return val or 0

def _date_filter(query, model_field, start, end):
    if start:
        query = query.filter(model_field >= datetime.strptime(start, "%Y-%m-%d"))
    if end:
        query = query.filter(model_field <= datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1))
    return query


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 1: STOCK REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r101_current_stock(db, warehouse_id=None, product_id=None, category=None):
    q = db.query(WarehouseStock, Product).join(Product, WarehouseStock.product_id == Product.id)
    if warehouse_id:
        q = q.filter(WarehouseStock.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(WarehouseStock.product_id == product_id)
    if category:
        q = q.filter(Product.category == category)
    rows = []
    for ws, p in q.all():
        rows.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku or "",
            "warehouse_id": ws.warehouse_id,
            "opening_qty": 0, "stock_in": 0, "stock_out": 0,
            "damage": 0, "returns": 0, "adjustment": 0,
            "closing_qty": ws.quantity, "rate": p.cost_price or 0,
            "stock_value": (p.cost_price or 0) * ws.quantity,
            "reorder_level": ws.reorder_level,
            "is_low_stock": ws.quantity <= ws.reorder_level if ws.reorder_level else False,
        })
    return {"data": rows, "summary": {"total_items": len(rows), "total_value": sum(r["stock_value"] for r in rows)}}


def r102_stock_movements(db, warehouse_id=None, product_id=None, start=None, end=None, movement_type=None):
    q = db.query(StockMovement).order_by(StockMovement.date.desc())
    if warehouse_id:
        q = q.filter(StockMovement.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(StockMovement.product_id == product_id)
    if movement_type:
        q = q.filter(StockMovement.movement_type == movement_type)
    q = _date_filter(q, StockMovement.date, start, end)
    rows = []
    for m in q.all():
        rows.append({
            "date": m.date.isoformat() if m.date else "",
            "movement_type": m.movement_type,
            "product_id": m.product_id,
            "qty": m.qty,
            "rate": m.rate or 0,
            "value": abs(m.qty or 0) * (m.rate or 0),
            "reference_id": m.reference_id,
            "reference_type": m.reference_type or "",
            "salesman_id": m.salesman_id,
            "shop_id": m.shop_id,
            "notes": m.notes or "",
        })
    total_in = sum(r["value"] for r in rows if r["qty"] > 0)
    total_out = sum(r["value"] for r in rows if r["qty"] < 0)
    return {"data": rows, "summary": {"total_in": total_in, "total_out": abs(total_out), "net": total_in - abs(total_out)}}


def r103_opening_closing(db, warehouse_id=None, start=None, end=None, product_id=None):
    q = db.query(WarehouseStock, Product).join(Product, WarehouseStock.product_id == Product.id)
    if warehouse_id:
        q = q.filter(WarehouseStock.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(WarehouseStock.product_id == product_id)
    rows = []
    for ws, p in q.all():
        total_in = db.query(sqlfunc.coalesce(sqlfunc.sum(StockMovement.qty), 0)).filter(
            StockMovement.warehouse_id == ws.warehouse_id,
            StockMovement.product_id == p.id,
            StockMovement.qty > 0,
        ).scalar()
        total_out = abs(db.query(sqlfunc.coalesce(sqlfunc.sum(StockMovement.qty), 0)).filter(
            StockMovement.warehouse_id == ws.warehouse_id,
            StockMovement.product_id == p.id,
            StockMovement.qty < 0,
        ).scalar())
        opening = max(0, ws.quantity - (total_in or 0) + (total_out or 0))
        rows.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku or "",
            "opening_qty": int(opening),
            "opening_value": int(opening) * (p.cost_price or 0),
            "total_in": int(total_in or 0),
            "total_out": int(total_out or 0),
            "closing_qty": ws.quantity,
            "closing_value": ws.quantity * (p.cost_price or 0),
            "difference": ws.quantity - opening,
        })
    return {"data": rows, "summary": {"total_closing_value": sum(r["closing_value"] for r in rows)}}


def r104_stock_valuation(db, warehouse_id=None, as_of=None, category=None):
    q = db.query(WarehouseStock, Product).join(Product, WarehouseStock.product_id == Product.id)
    if warehouse_id:
        q = q.filter(WarehouseStock.warehouse_id == warehouse_id)
    if category:
        q = q.filter(Product.category == category)
    rows = []
    for ws, p in q.all():
        avg_rate = p.cost_price or 0
        rows.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku or "",
            "qty": ws.quantity, "avg_rate": avg_rate,
            "total_value": avg_rate * ws.quantity,
        })
    return {"data": rows, "summary": {"grand_total": sum(r["total_value"] for r in rows)}}


def r105_low_stock(db, warehouse_id=None, category=None):
    q = db.query(WarehouseStock, Product).join(Product, WarehouseStock.product_id == Product.id).filter(
        WarehouseStock.quantity <= WarehouseStock.reorder_level
    )
    if warehouse_id:
        q = q.filter(WarehouseStock.warehouse_id == warehouse_id)
    if category:
        q = q.filter(Product.category == category)
    rows = []
    for ws, p in q.all():
        rows.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku or "",
            "warehouse_id": ws.warehouse_id,
            "current_qty": ws.quantity,
            "min_threshold": ws.reorder_level or 0,
            "shortage_qty": max(0, (ws.reorder_level or 0) - ws.quantity),
        })
    return {"data": rows, "summary": {"total_shortage": sum(r["shortage_qty"] for r in rows)}}


def r106_damage_report(db, warehouse_id=None, product_id=None, start=None, end=None):
    q = db.query(StockMovement).filter(StockMovement.movement_type == "damage").order_by(StockMovement.date.desc())
    if warehouse_id:
        q = q.filter(StockMovement.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(StockMovement.product_id == product_id)
    q = _date_filter(q, StockMovement.date, start, end)
    rows = []
    for m in q.all():
        rows.append({
            "date": m.date.isoformat() if m.date else "",
            "product_id": m.product_id,
            "qty": abs(m.qty or 0),
            "rate": m.rate or 0,
            "loss_value": abs(m.qty or 0) * (m.rate or 0),
            "reason": m.notes or "",
            "warehouse_id": m.warehouse_id,
        })
    return {"data": rows, "summary": {"total_loss": sum(r["loss_value"] for r in rows)}}


def r107_stock_ledger(db, warehouse_id, product_id, start=None, end=None):
    q = db.query(StockLedger).filter(
        StockLedger.warehouse_id == warehouse_id,
        StockLedger.product_id == product_id,
    ).order_by(StockLedger.created_at.asc())
    if start or end:
        q = _date_filter(q, StockLedger.created_at, start, end)
    rows = []
    for sl in q.all():
        rows.append({
            "date": sl.created_at.isoformat() if sl.created_at else "",
            "reference_id": sl.reference_id,
            "reference_type": sl.reference_type or "",
            "transaction_type": sl.transaction_type,
            "in_qty": sl.quantity if sl.quantity > 0 else 0,
            "out_qty": abs(sl.quantity) if sl.quantity < 0 else 0,
            "balance_qty": sl.balance_after,
            "rate": sl.rate or 0,
            "value": sl.value or 0,
            "narration": sl.notes or "",
        })
    return {"data": rows, "summary": {}}


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 2: SALESMAN REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r201_salesman_performance(db, salesman_id=None, start=None, end=None, area=None):
    from backend.models.warehouse import SalesmanWarehouse
    q = db.query(SalesmanWarehouse)
    if salesman_id:
        q = q.filter(SalesmanWarehouse.salesman_id == salesman_id)
    rows = []
    for sw in q.all():
        inv_q = db.query(Invoice).filter(Invoice.salesman_id == sw.salesman_id, Invoice.warehouse_id == sw.warehouse_id)
        if start or end:
            inv_q = _date_filter(inv_q, Invoice.date, start, end)
        invoices = inv_q.all()
        total_amount = sum(i.net_total for i in invoices)
        total_collected = sum(i.paid_amount for i in invoices)
        total_outstanding = sum(i.balance_amount for i in invoices)
        ret_q = db.query(sqlfunc.coalesce(sqlfunc.sum(Return.qty * Return.rate), 0)).filter(
            Return.salesman_id == sw.salesman_id,
            Return.warehouse_id == sw.warehouse_id,
        ).scalar()
        rows.append({
            "salesman_id": sw.salesman_id,
            "warehouse_id": sw.warehouse_id,
            "total_deliveries": len(invoices),
            "total_amount": float(total_amount),
            "cash_collected": float(total_collected),
            "outstanding": float(total_outstanding),
            "return_value": float(ret_q or 0),
        })
    rows.sort(key=lambda r: r["total_amount"], reverse=True)
    return {"data": rows, "summary": {
        "total_amount": sum(r["total_amount"] for r in rows),
        "total_collected": sum(r["cash_collected"] for r in rows),
    }}


def r202_salesman_deliveries(db, salesman_id, start=None, end=None, shop_id=None):
    q = db.query(Invoice).filter(Invoice.salesman_id == salesman_id).order_by(Invoice.date.desc())
    if shop_id:
        q = q.filter(Invoice.shop_id == shop_id)
    q = _date_filter(q, Invoice.date, start, end)
    rows = []
    for inv in q.all():
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
        rows.append({
            "date": inv.date.isoformat() if inv.date else "",
            "shop_id": inv.shop_id,
            "invoice_id": inv.id,
            "invoice_no": inv.invoice_no,
            "products_summary": ", ".join([f"#{i.product_id}x{i.qty}" for i in items]),
            "net_total": inv.net_total,
            "paid": inv.paid_amount,
            "balance": inv.balance_amount,
            "status": inv.status,
        })
    return {"data": rows, "summary": {
        "total_delivered": sum(r["net_total"] for r in rows),
        "total_collected": sum(r["paid"] for r in rows),
        "total_pending": sum(r["balance"] for r in rows),
    }}


def r203_salesman_collections(db, salesman_id=None, start=None, end=None):
    q = db.query(ShopPayment).order_by(ShopPayment.date.desc())
    if salesman_id:
        q = q.filter(ShopPayment.salesman_id == salesman_id)
    q = _date_filter(q, ShopPayment.date, start, end)
    rows = []
    for p in q.all():
        rows.append({
            "date": p.date.isoformat() if p.date else "",
            "shop_id": p.shop_id,
            "amount": p.amount,
            "payment_mode": p.payment_mode or "",
            "reference": p.reference or "",
            "invoice_id": p.invoice_id,
        })
    return {"data": rows, "summary": {"total_collection": sum(r["amount"] for r in rows)}}


def r204_salesman_outstanding(db, salesman_id=None, area=None, aging=None):
    q = db.query(Invoice).filter(Invoice.status.in_(["unpaid", "partial"])).order_by(Invoice.date.asc())
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if area:
        q = q.join(Shop).filter(Shop.area_id == area)
    now = datetime.utcnow()
    rows = []
    for inv in q.all():
        days = (now - inv.date).days if inv.date else 0
        bucket = "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        if aging and bucket != aging:
            continue
        rows.append({
            "shop_id": inv.shop_id,
            "invoice_id": inv.id,
            "invoice_no": inv.invoice_no,
            "invoice_date": inv.date.isoformat() if inv.date else "",
            "net_total": inv.net_total,
            "paid": inv.paid_amount,
            "balance": inv.balance_amount,
            "days_overdue": days,
            "aging_bucket": bucket,
        })
    return {"data": rows, "summary": {"total_outstanding": sum(r["balance"] for r in rows)}}


def r205_salesman_area(db, start=None, end=None):
    from backend.models.warehouse import SalesmanWarehouse, Area
    q = db.query(SalesmanWarehouse).all()
    area_data = {}
    for sw in q:
        shops = db.query(Shop).filter(Shop.salesman_id == sw.salesman_id).count()
        inv_q = db.query(Invoice).filter(Invoice.salesman_id == sw.salesman_id)
        if start or end:
            inv_q = _date_filter(inv_q, Invoice.date, start, end)
        invoices = inv_q.all()
        total_sales = sum(i.net_total for i in invoices)
        total_collection = sum(i.paid_amount for i in invoices)
        total_outstanding = sum(i.balance_amount for i in invoices)
        area_data[f"{sw.salesman_id}-{sw.warehouse_id}"] = {
            "salesman_id": sw.salesman_id,
            "warehouse_id": sw.warehouse_id,
            "shops_covered": shops,
            "total_sales": float(total_sales),
            "collection": float(total_collection),
            "outstanding": float(total_outstanding),
        }
    return {"data": list(area_data.values()), "summary": {}}


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 3: SHOP REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r301_shop_purchases(db, shop_id, start=None, end=None, product_id=None, salesman_id=None):
    q = db.query(Invoice).filter(Invoice.shop_id == shop_id).order_by(Invoice.date.desc())
    q = _date_filter(q, Invoice.date, start, end)
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    rows = []
    for inv in q.all():
        if product_id:
            items = db.query(InvoiceItem).filter(
                InvoiceItem.invoice_id == inv.id, InvoiceItem.product_id == product_id,
            ).all()
            if not items:
                continue
        else:
            items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
        rows.append({
            "date": inv.date.isoformat() if inv.date else "",
            "invoice_id": inv.id,
            "invoice_no": inv.invoice_no,
            "salesman_id": inv.salesman_id,
            "products": ", ".join([f"#{i.product_id}x{i.qty}" for i in items]),
            "gross": inv.gross_total,
            "discount": inv.discount,
            "net": inv.net_total,
            "paid": inv.paid_amount,
            "balance": inv.balance_amount,
        })
    return {"data": rows, "summary": {
        "total_purchased": sum(r["net"] for r in rows),
        "total_paid": sum(r["paid"] for r in rows),
        "total_outstanding": sum(r["balance"] for r in rows),
    }}


def r302_shop_outstanding(db, area=None, salesman_id=None, aging=None, min_balance=None):
    q = db.query(Invoice).filter(Invoice.status.in_(["unpaid", "partial"])).order_by(Invoice.balance_amount.desc())
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if area:
        q = q.join(Shop).filter(Shop.area_id == area)
    if min_balance:
        q = q.filter(Invoice.balance_amount >= float(min_balance))
    now = datetime.utcnow()
    rows = []
    for inv in q.all():
        days = (now - inv.date).days if inv.date else 0
        bucket = "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        if aging and bucket != aging:
            continue
        last_payment = db.query(ShopPayment).filter(
            ShopPayment.shop_id == inv.shop_id,
            ShopPayment.invoice_id == inv.id,
        ).order_by(ShopPayment.date.desc()).first()
        rows.append({
            "shop_id": inv.shop_id,
            "salesman_id": inv.salesman_id,
            "total_invoices": 1,
            "net_total": inv.net_total,
            "paid": inv.paid_amount,
            "balance": inv.balance_amount,
            "last_payment_date": last_payment.date.isoformat() if last_payment else "",
        })
    grouped = {}
    for r in rows:
        key = r["shop_id"]
        if key not in grouped:
            r["total_invoices"] = 0
            grouped[key] = r
        grouped[key]["total_invoices"] += 1
        grouped[key]["net_total"] += r["net_total"]
        grouped[key]["paid"] += r["paid"]
        grouped[key]["balance"] += r["balance"]
    return {"data": list(grouped.values()), "summary": {"total_outstanding": sum(g["balance"] for g in grouped.values())}}


def r303_shop_ledger(db, shop_id, start=None, end=None):
    entries = []
    inv_q = db.query(Invoice).filter(Invoice.shop_id == shop_id)
    inv_q = _date_filter(inv_q, Invoice.date, start, end)
    for inv in inv_q.all():
        entries.append({
            "date": inv.date.isoformat() if inv.date else "",
            "type": "Invoice",
            "reference": inv.invoice_no,
            "debit": inv.net_total,
            "credit": 0,
            "balance": 0,
        })
    pay_q = db.query(ShopPayment).filter(ShopPayment.shop_id == shop_id)
    pay_q = _date_filter(pay_q, ShopPayment.date, start, end)
    for p in pay_q.all():
        entries.append({
            "date": p.date.isoformat() if p.date else "",
            "type": "Payment",
            "reference": f"P-{p.id}",
            "debit": 0,
            "credit": p.amount,
            "balance": 0,
        })
    ret_q = db.query(Return).filter(Return.shop_id == shop_id)
    ret_q = _date_filter(ret_q, Return.date, start, end)
    for r in ret_q.all():
        val = (r.qty or 0) * (r.rate or 0)
        entries.append({
            "date": r.date.isoformat() if r.date else "",
            "type": "Return",
            "reference": f"R-{r.id}",
            "debit": 0,
            "credit": val,
            "balance": 0,
        })
    entries.sort(key=lambda e: e["date"])
    running = 0
    for e in entries:
        running += e["debit"] - e["credit"]
        e["balance"] = running
    return {"data": entries, "summary": {"current_balance": running if entries else 0}}


def r304_top_shops(db, start=None, end=None, salesman_id=None, area=None, top_n=20):
    q = db.query(
        Invoice.shop_id, sqlfunc.count(Invoice.id), sqlfunc.sum(Invoice.net_total),
        sqlfunc.sum(Invoice.paid_amount), sqlfunc.sum(Invoice.balance_amount),
    ).group_by(Invoice.shop_id).order_by(sqlfunc.sum(Invoice.net_total).desc())
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if start or end:
        q = _date_filter(q, Invoice.date, start, end)
    if area:
        q = q.join(Shop).filter(Shop.area_id == area)
    rows = [{
        "shop_id": shop_id,
        "total_purchases": float(net or 0),
        "total_paid": float(paid or 0),
        "outstanding": float(bal or 0),
    } for shop_id, cnt, net, paid, bal in q.limit(top_n).all()]
    return {"data": rows, "summary": {}}


def r305_shop_returns(db, shop_id=None, start=None, end=None, salesman_id=None):
    q = db.query(Return).order_by(Return.date.desc())
    if shop_id:
        q = q.filter(Return.shop_id == shop_id)
    if salesman_id:
        q = q.filter(Return.salesman_id == salesman_id)
    q = _date_filter(q, Return.date, start, end)
    rows = []
    for r in q.all():
        rows.append({
            "date": r.date.isoformat() if r.date else "",
            "shop_id": r.shop_id,
            "product_id": r.product_id,
            "return_qty": r.qty,
            "rate": r.rate or 0,
            "return_value": (r.qty or 0) * (r.rate or 0),
            "reason": r.reason or "",
            "invoice_id": r.invoice_id,
        })
    return {"data": rows, "summary": {"total_return_value": sum(r["return_value"] for r in rows)}}


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 4: INVOICE REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r401_invoice_list(db, start=None, end=None, salesman_id=None, shop_id=None, status=None, warehouse_id=None):
    q = db.query(Invoice).order_by(Invoice.date.desc())
    q = _date_filter(q, Invoice.date, start, end)
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if shop_id:
        q = q.filter(Invoice.shop_id == shop_id)
    if status:
        q = q.filter(Invoice.status == status)
    if warehouse_id:
        q = q.filter(Invoice.warehouse_id == warehouse_id)
    rows = [{
        "invoice_id": i.id, "invoice_no": i.invoice_no,
        "date": i.date.isoformat() if i.date else "",
        "shop_id": i.shop_id, "salesman_id": i.salesman_id,
        "net_total": i.net_total, "paid": i.paid_amount,
        "balance": i.balance_amount, "status": i.status,
    } for i in q.all()]
    return {"data": rows, "summary": {
        "total_invoiced": sum(r["net_total"] for r in rows),
        "total_collected": sum(r["paid"] for r in rows),
        "total_pending": sum(r["balance"] for r in rows),
    }}


def r402_daily_delivery(db, date_str, salesman_id=None, warehouse_id=None):
    target = datetime.strptime(date_str, "%Y-%m-%d") if date_str else datetime.utcnow()
    q = db.query(Invoice).filter(sqlfunc.date(Invoice.date) == target.date()).order_by(Invoice.date.asc())
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if warehouse_id:
        q = q.filter(Invoice.warehouse_id == warehouse_id)
    rows = []
    for inv in q.all():
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
        rows.append({
            "invoice_id": inv.id, "invoice_no": inv.invoice_no,
            "shop_id": inv.shop_id, "products": ", ".join([f"#{i.product_id}x{i.qty}" for i in items]),
            "total_qty": sum(i.qty for i in items),
            "net_total": inv.net_total, "paid": inv.paid_amount, "balance": inv.balance_amount,
        })
    return {"data": rows, "summary": {"total_amount": sum(r["net_total"] for r in rows)}}


def r403_product_sales(db, product_id=None, start=None, end=None, warehouse_id=None, salesman_id=None):
    q = db.query(InvoiceItem, Invoice).join(Invoice, InvoiceItem.invoice_id == Invoice.id)
    if product_id:
        q = q.filter(InvoiceItem.product_id == product_id)
    if warehouse_id:
        q = q.filter(Invoice.warehouse_id == warehouse_id)
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    q = _date_filter(q, Invoice.date, start, end)
    sales = {}
    for item, inv in q.all():
        pid = item.product_id
        if pid not in sales:
            sales[pid] = {"product_id": pid, "total_qty": 0, "total_amount": 0, "count": 0}
        sales[pid]["total_qty"] += item.qty
        sales[pid]["total_amount"] += item.amount
        sales[pid]["count"] += 1
    rows = [{
        "product_id": v["product_id"],
        "total_qty": v["total_qty"],
        "total_amount": v["total_amount"],
        "avg_rate": v["total_amount"] / v["total_qty"] if v["total_qty"] else 0,
    } for v in sorted(sales.values(), key=lambda x: x["total_amount"], reverse=True)]
    return {"data": rows, "summary": {"total_sales": sum(r["total_amount"] for r in rows)}}


def r404_discount_report(db, start=None, end=None, salesman_id=None, shop_id=None):
    q = db.query(Invoice).filter(Invoice.discount > 0).order_by(Invoice.date.desc())
    q = _date_filter(q, Invoice.date, start, end)
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if shop_id:
        q = q.filter(Invoice.shop_id == shop_id)
    rows = [{
        "date": i.date.isoformat() if i.date else "", "invoice_id": i.id,
        "invoice_no": i.invoice_no, "shop_id": i.shop_id,
        "gross_total": i.gross_total, "discount": i.discount,
        "discount_pct": round((i.discount / i.gross_total * 100), 2) if i.gross_total else 0,
        "net_total": i.net_total,
    } for i in q.all()]
    return {"data": rows, "summary": {"total_discount": sum(r["discount"] for r in rows)}}


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 5: PAYMENT REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r501_daily_collection(db, start=None, end=None, salesman_id=None):
    q = db.query(ShopPayment).order_by(ShopPayment.date.desc())
    if salesman_id:
        q = q.filter(ShopPayment.salesman_id == salesman_id)
    q = _date_filter(q, ShopPayment.date, start, end)
    rows = [{
        "date": p.date.isoformat() if p.date else "", "salesman_id": p.salesman_id,
        "shop_id": p.shop_id, "amount": p.amount, "payment_mode": p.payment_mode or "",
        "reference": p.reference or "", "invoice_id": p.invoice_id,
    } for p in q.all()]
    per_salesman = {}
    for r in rows:
        sid = r["salesman_id"]
        per_salesman[sid] = per_salesman.get(sid, 0) + r["amount"]
    return {"data": rows, "summary": {
        "grand_total": sum(r["amount"] for r in rows),
        "per_salesman": per_salesman,
    }}


def r502_payment_history(db, shop_id=None, salesman_id=None, start=None, end=None, payment_mode=None):
    q = db.query(ShopPayment).order_by(ShopPayment.date.desc())
    if shop_id:
        q = q.filter(ShopPayment.shop_id == shop_id)
    if salesman_id:
        q = q.filter(ShopPayment.salesman_id == salesman_id)
    if payment_mode:
        q = q.filter(ShopPayment.payment_mode == payment_mode)
    q = _date_filter(q, ShopPayment.date, start, end)
    rows = [{
        "date": p.date.isoformat() if p.date else "", "shop_id": p.shop_id,
        "salesman_id": p.salesman_id, "amount": p.amount,
        "payment_mode": p.payment_mode or "", "reference": p.reference or "",
        "invoice_id": p.invoice_id, "notes": p.notes or "",
    } for p in q.all()]
    return {"data": rows, "summary": {"total": sum(r["amount"] for r in rows)}}


def r503_aging(db, as_of=None, salesman_id=None, area=None):
    now = datetime.strptime(as_of, "%Y-%m-%d") if as_of else datetime.utcnow()
    q = db.query(Invoice).filter(Invoice.status.in_(["unpaid", "partial"])).order_by(Invoice.date.asc())
    if salesman_id:
        q = q.filter(Invoice.salesman_id == salesman_id)
    if area:
        q = q.join(Shop).filter(Shop.area_id == area)
    buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    shop_data = {}
    for inv in q.all():
        days = (now - inv.date).days if inv.date else 0
        bucket = "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        buckets[bucket] += inv.balance_amount
        sid = inv.shop_id
        if sid not in shop_data:
            shop_data[sid] = {"shop_id": sid, "total_outstanding": 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        shop_data[sid]["total_outstanding"] += inv.balance_amount
        shop_data[sid][bucket] += inv.balance_amount
    return {"data": list(shop_data.values()), "summary": {"buckets": buckets, "total": sum(buckets.values())}}


def r504_cashflow(db, start=None, end=None, salesman_id=None):
    q = db.query(ShopPayment).order_by(ShopPayment.date.asc())
    if salesman_id:
        q = q.filter(ShopPayment.salesman_id == salesman_id)
    q = _date_filter(q, ShopPayment.date, start, end)
    daily = {}
    for p in q.all():
        day = p.date.strftime("%Y-%m-%d") if p.date else ""
        if day not in daily:
            daily[day] = {"date": day, "cash_in": 0, "cash_out": 0}
        daily[day]["cash_in"] += p.amount
    daily_list = sorted(daily.values(), key=lambda d: d["date"])
    running = 0
    for d in daily_list:
        running += d["cash_in"] - d["cash_out"]
        d["opening_balance"] = running - d["cash_in"] + d["cash_out"]
        d["closing_balance"] = running
    return {"data": daily_list, "summary": {"total_in": sum(d["cash_in"] for d in daily_list)}}


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 6: TRANSFER & RETURN REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r601_transfers(db, source_id=None, dest_id=None, start=None, end=None):
    q = db.query(StockMovement).filter(
        StockMovement.movement_type.in_(["transfer_out", "transfer_in"]),
    ).order_by(StockMovement.date.desc())
    q = _date_filter(q, StockMovement.date, start, end)
    if source_id:
        q = q.filter(StockMovement.from_warehouse_id == source_id)
    if dest_id:
        q = q.filter(StockMovement.to_warehouse_id == dest_id)
    rows = []
    for m in q.all():
        rows.append({
            "date": m.date.isoformat() if m.date else "",
            "from_warehouse": m.from_warehouse_id,
            "to_warehouse": m.to_warehouse_id,
            "product_id": m.product_id,
            "qty": abs(m.qty or 0),
            "rate": m.rate or 0,
            "value": abs(m.qty or 0) * (m.rate or 0),
            "movement_type": m.movement_type,
            "reference": f"{m.reference_type or ''}-{m.reference_id or ''}",
        })
    return {"data": rows, "summary": {"total_value": sum(r["value"] for r in rows)}}


def r602_returns_combined(db, return_type=None, start=None, end=None, warehouse_id=None, product_id=None):
    q = db.query(Return).order_by(Return.date.desc())
    if return_type and return_type != "both":
        q = q.filter(Return.return_type == return_type)
    if warehouse_id:
        q = q.filter(Return.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(Return.product_id == product_id)
    q = _date_filter(q, Return.date, start, end)
    rows = [{
        "date": r.date.isoformat() if r.date else "",
        "return_type": r.return_type,
        "shop_id": r.shop_id,
        "salesman_id": r.salesman_id,
        "product_id": r.product_id,
        "qty": r.qty,
        "value": (r.qty or 0) * (r.rate or 0),
        "reason": r.reason or "",
        "invoice_id": r.invoice_id,
    } for r in q.all()]
    return {"data": rows, "summary": {"total_value": sum(r["value"] for r in rows)}}


# ═══════════════════════════════════════════════════════════════════════════
# GROUP 7: FINANCE / COA REPORTS
# ═══════════════════════════════════════════════════════════════════════════

def r701_trial_balance(db, warehouse_id):
    accounts = db.query(WarehouseCOAAccount).filter(
        WarehouseCOAAccount.warehouse_id == warehouse_id,
    ).all()
    rows = []
    for acct in accounts:
        total_dr = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseJournalLine.debit), 0)).filter(
            WarehouseJournalLine.account_id == acct.id,
        ).scalar()
        total_cr = db.query(sqlfunc.coalesce(sqlfunc.sum(WarehouseJournalLine.credit), 0)).filter(
            WarehouseJournalLine.account_id == acct.id,
        ).scalar()
        rows.append({
            "account_id": acct.id, "account_code": acct.account_code or "",
            "account_name": acct.account_name, "account_type": acct.account_type,
            "debit": float(total_dr or 0), "credit": float(total_cr or 0),
            "balance": float((total_dr or 0) - (total_cr or 0)),
        })
    return {"data": rows, "summary": {
        "total_debits": sum(r["debit"] for r in rows),
        "total_credits": sum(r["credit"] for r in rows),
    }}


def r702_journal_entries(db, warehouse_id, start=None, end=None, account_id=None):
    q = db.query(WarehouseJournalEntry).order_by(WarehouseJournalEntry.date.desc())
    if warehouse_id:
        q = q.filter(WarehouseJournalEntry.warehouse_id == warehouse_id)
    if account_id:
        q = q.join(WarehouseJournalLine).filter(WarehouseJournalLine.account_id == account_id)
    q = _date_filter(q, WarehouseJournalEntry.date, start, end)
    rows = []
    for e in q.all():
        lines = db.query(WarehouseJournalLine).filter(WarehouseJournalLine.journal_id == e.id).all()
        rows.append({
            "id": e.id, "date": e.date.isoformat() if e.date else "",
            "reference": e.reference or "", "narration": e.narration or "",
            "lines": [{
                "account_id": l.account_id,
                "debit": l.debit, "credit": l.credit,
            } for l in lines],
        })
    return {"data": rows, "summary": {}}


def r703_account_ledger(db, account_id, start=None, end=None):
    lines = db.query(WarehouseJournalLine).join(WarehouseJournalEntry).filter(
        WarehouseJournalLine.account_id == account_id,
    ).order_by(WarehouseJournalEntry.date.asc()).all()
    rows = []
    running = 0
    for l in lines:
        je = l.journal_entry
        running += l.debit - l.credit
        rows.append({
            "date": je.date.isoformat() if je.date else "",
            "reference": je.reference or "",
            "narration": je.narration or "",
            "debit": l.debit, "credit": l.credit,
            "balance": running,
        })
    return {"data": rows, "summary": {"current_balance": running}}


def r704_profit_loss(db, warehouse_id, start=None, end=None):
    inv_q = db.query(Invoice).filter(Invoice.warehouse_id == warehouse_id)
    inv_q = _date_filter(inv_q, Invoice.date, start, end)
    invoices = inv_q.all()

    sales_revenue = sum(i.net_total for i in invoices)
    total_discount = sum(i.discount for i in invoices)

    items = db.query(InvoiceItem).join(Invoice).filter(
        Invoice.warehouse_id == warehouse_id,
    ).all()
    if start or end:
        inv_subq = inv_q.subquery()
        items = db.query(InvoiceItem).join(inv_subq, InvoiceItem.invoice_id == inv_subq.c.id).all()

    total_cost = 0
    for item in items:
        p = db.query(Product).filter(Product.id == item.product_id).first()
        total_cost += item.qty * (p.cost_price or 0) if p else 0

    damage_value = db.query(sqlfunc.coalesce(sqlfunc.sum(StockMovement.qty * StockMovement.rate), 0)).filter(
        StockMovement.warehouse_id == warehouse_id,
        StockMovement.movement_type == "damage",
    ).scalar()

    returns_value = db.query(sqlfunc.coalesce(sqlfunc.sum(Return.qty * Return.rate), 0)).filter(
        Return.warehouse_id == warehouse_id,
    ).scalar()

    net_sales = sales_revenue - returns_value - total_discount
    gross_profit = net_sales - total_cost
    total_expenses = float(damage_value or 0)
    net_profit = gross_profit - total_expenses

    rows = [
        {"label": "Sales Revenue", "amount": sales_revenue, "type": "income"},
        {"label": "Less: Sales Returns", "amount": -float(returns_value or 0), "type": "income"},
        {"label": "Less: Discount Allowed", "amount": -total_discount, "type": "income"},
        {"label": "Net Sales", "amount": net_sales, "type": "income"},
        {"label": "Cost of Goods Sold", "amount": -total_cost, "type": "expense"},
        {"label": "Gross Profit", "amount": gross_profit, "type": "profit"},
        {"label": "Damage & Loss", "amount": -float(damage_value or 0), "type": "expense"},
        {"label": "Net Profit / Loss", "amount": net_profit, "type": "profit"},
    ]
    return {"data": rows, "summary": {
        "net_sales": net_sales, "total_cost": total_cost,
        "gross_profit": gross_profit, "net_profit": net_profit,
    }}
