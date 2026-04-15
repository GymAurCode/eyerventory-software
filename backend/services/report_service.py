from datetime import date, datetime
from io import BytesIO

import xlsxwriter
from sqlalchemy.orm import Session

from backend.models.expense import Expense
from backend.models.owner_share import OwnerShare
from backend.models.product import Product
from backend.models.sale import Sale
from backend.models.user import User
from backend.services.finance_service import get_finance_summary
from backend.services.settings_service import get_company_name


def _fmt(v: float) -> str:
    return f"PKR {v:,.2f}"


def _dataset(db: Session, report_type: str) -> tuple[list[tuple], float]:
    if report_type == "products":
        rows = db.query(Product).order_by(Product.name.asc()).all()
        return [(p.name, _fmt(p.cost_price), p.stock) for p in rows], 0.0
    if report_type == "sales":
        rows = db.query(Sale).order_by(Sale.created_at.desc()).all()
        total = sum(r.revenue for r in rows)
        return [(r.id, r.product_id, r.quantity, _fmt(r.revenue), str(r.created_at.date())) for r in rows], total
    if report_type == "expenses":
        rows = db.query(Expense).order_by(Expense.expense_date.desc()).all()
        total = sum(r.amount for r in rows)
        return [(r.category, _fmt(r.amount), str(r.expense_date), r.note or "-") for r in rows], total
    if report_type == "finance":
        s = get_finance_summary(db)
        rows = [
            ("Revenue", _fmt(s["total_revenue"])),
            ("Cost", _fmt(s["total_cost"])),
            ("Expenses", _fmt(s["total_expenses"])),
            ("Raw Profit", _fmt(s["raw_profit"])),
            ("Donation", _fmt(s["donation_amount"])),
            ("Final Profit", _fmt(s["total_profit"])),
        ]
        return rows, s["total_profit"]
    if report_type == "partner_profit":
        s = get_finance_summary(db)
        rows = (
            db.query(User.name, OwnerShare.ownership_percentage)
            .join(OwnerShare, OwnerShare.user_id == User.id)
            .filter(User.role == "owner")
            .all()
        )
        mapped = [(name, f"{pct:.2f}%", _fmt(s["distributable_profit"] * (pct / 100))) for name, pct in rows]
        return mapped, s["distributable_profit"]
    raise ValueError("Unsupported report type")


def get_report_payload(db: Session, report_type: str) -> dict:
    title = f"{report_type.replace('_', ' ').title()} Report"

    if report_type == "products":
        rows = db.query(Product).order_by(Product.name.asc()).all()
        columns = [
            {"header": "Product Name", "key": "name", "align": "left"},
            {"header": "Category", "key": "category", "align": "left"},
            {"header": "Stock", "key": "stock", "align": "right"},
            {"header": "Price", "key": "price", "align": "right"},
            {"header": "Total Value", "key": "total_value", "align": "right"},
        ]
        data = [
            {
                "name": p.name,
                "category": "General",
                "stock": p.stock,
                "price": _fmt(p.cost_price),
                "total_value": _fmt(p.stock * p.cost_price),
            }
            for p in rows
        ]
        return {"title": title, "columns": columns, "data": data}

    if report_type == "sales":
        rows = db.query(Sale).order_by(Sale.created_at.desc()).all()
        product_ids = [r.product_id for r in rows]
        products = db.query(Product.id, Product.name).filter(Product.id.in_(product_ids)).all() if product_ids else []
        names_by_id = {item.id: item.name for item in products}
        columns = [
            {"header": "Date", "key": "date", "align": "left"},
            {"header": "Product", "key": "product", "align": "left"},
            {"header": "Quantity", "key": "quantity", "align": "right"},
            {"header": "Total", "key": "total", "align": "right"},
        ]
        data = [
            {
                "date": str(r.created_at.date()),
                "product": names_by_id.get(r.product_id, f"Product #{r.product_id}"),
                "quantity": r.quantity,
                "total": _fmt(r.revenue),
            }
            for r in rows
        ]
        return {"title": title, "columns": columns, "data": data}

    if report_type == "expenses":
        rows = db.query(Expense).order_by(Expense.expense_date.desc()).all()
        columns = [
            {"header": "Title", "key": "title", "align": "left"},
            {"header": "Amount", "key": "amount", "align": "right"},
            {"header": "Date", "key": "date", "align": "left"},
            {"header": "Note", "key": "note", "align": "left"},
        ]
        data = [
            {
                "title": r.category,
                "amount": _fmt(r.amount),
                "date": str(r.expense_date),
                "note": r.note or "-",
            }
            for r in rows
        ]
        return {"title": title, "columns": columns, "data": data}

    if report_type == "finance":
        s = get_finance_summary(db)
        columns = [
            {"header": "Metric", "key": "metric", "align": "left"},
            {"header": "Value", "key": "value", "align": "right"},
        ]
        data = [
            {"metric": "Revenue", "value": _fmt(s["total_revenue"])},
            {"metric": "Cost", "value": _fmt(s["total_cost"])},
            {"metric": "Expenses", "value": _fmt(s["total_expenses"])},
            {"metric": "Raw Profit", "value": _fmt(s["raw_profit"])},
            {"metric": "Donation", "value": _fmt(s["donation_amount"])},
            {"metric": "Final Profit", "value": _fmt(s["total_profit"])},
        ]
        return {"title": title, "columns": columns, "data": data}

    if report_type == "partner_profit":
        s = get_finance_summary(db)
        rows = (
            db.query(User.name, OwnerShare.ownership_percentage)
            .join(OwnerShare, OwnerShare.user_id == User.id)
            .filter(User.role == "owner")
            .all()
        )
        columns = [
            {"header": "Partner Name", "key": "partner_name", "align": "left"},
            {"header": "Share", "key": "share", "align": "right"},
            {"header": "Profit", "key": "profit", "align": "right"},
        ]
        data = [
            {
                "partner_name": name,
                "share": f"{pct:.2f}%",
                "profit": _fmt(s["distributable_profit"] * (pct / 100)),
            }
            for name, pct in rows
        ]
        return {"title": title, "columns": columns, "data": data}

    raise ValueError("Unsupported report type")


def generate_excel(db: Session, report_type: str) -> BytesIO:
    rows, total = _dataset(db, report_type)
    now = datetime.now()
    company_name = get_company_name(db)
    buffer = BytesIO()
    wb = xlsxwriter.Workbook(buffer, {"in_memory": True})
    ws = wb.add_worksheet("report")
    ws.write(0, 0, "Company")
    ws.write(0, 1, company_name)
    ws.write(1, 0, "Report")
    ws.write(1, 1, report_type)
    ws.write(2, 0, "Generated")
    ws.write(2, 1, now.strftime("%Y-%m-%d %H:%M:%S"))
    for idx, row in enumerate(rows, start=4):
        for col, cell in enumerate(row):
            ws.write(idx, col, cell)
    ws.write(len(rows) + 6, 0, "Total")
    ws.write(len(rows) + 6, 1, _fmt(total))
    wb.close()
    buffer.seek(0)
    return buffer
