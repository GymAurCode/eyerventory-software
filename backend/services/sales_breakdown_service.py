import datetime
from calendar import monthrange
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.expense import Expense
from backend.models.partner_agreement import PartnerAgreement
from backend.models.purchase import Purchase
from backend.models.sale import Sale
from backend.services.settings_service import get_donation_settings


def _get_month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end


def _get_week_ranges(year: int, month: int) -> list[dict]:
    start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)
    weeks = []
    week_start = start
    week_num = 1
    while week_start < month_end:
        week_end_candidate = date(year, month, week_start.day + 6)
        if week_end_candidate >= month_end:
            week_end = month_end
        else:
            week_end = week_end_candidate
        weeks.append({"week": week_num, "start": week_start, "end": week_end})
        week_start = date(year, month, week_start.day + 7)
        week_num += 1
    return weeks


def _pos_revenue_in_range(db: Session, start: date, end: date) -> float:
    from backend.models.pos_sale import PosSale
    result = db.query(func.coalesce(func.sum(PosSale.total), 0.0)).filter(
        PosSale.created_at >= start,
        PosSale.created_at < end,
        PosSale.status != "returned",
    ).scalar()
    return float(result)


def _legacy_revenue_in_range(db: Session, start: date, end: date) -> float:
    result = db.query(func.coalesce(func.sum(Sale.revenue), 0.0)).filter(
        Sale.created_at >= start,
        Sale.created_at < end,
    ).scalar()
    return float(result)


def _expenses_in_range(db: Session, start: date, end: date) -> float:
    result = db.query(func.coalesce(func.sum(Expense.total_amount), 0.0)).filter(
        Expense.expense_date >= start,
        Expense.expense_date < end,
    ).scalar()
    return float(result)


def _purchases_in_range(db: Session, start: date, end: date) -> float:
    result = db.query(func.coalesce(func.sum(Purchase.final_amount), 0.0)).filter(
        Purchase.purchase_date >= start,
        Purchase.purchase_date < end,
    ).scalar()
    return float(result)


def _outstanding_credit_in_range(db: Session, start: date, end: date) -> float:
    from backend.models.credit import CreditAccount, CreditTransaction
    account_ids_with_txn = set()
    txns = db.query(CreditTransaction.credit_account_id).filter(
        CreditTransaction.created_at >= start,
        CreditTransaction.created_at < end,
    ).distinct().all()
    for (aid,) in txns:
        account_ids_with_txn.add(aid)
    accounts = db.query(CreditAccount).filter(
        CreditAccount.id.in_(list(account_ids_with_txn)) if account_ids_with_txn else False,
    ).all()
    if not accounts:
        accounts = db.query(CreditAccount).filter(
            CreditAccount.created_at >= start,
            CreditAccount.created_at < end,
        ).all()
    total = sum(
        max(0.0, ca.total_amount - ca.paid_amount) for ca in accounts
    )
    return float(total)


def get_monthly_breakdown(db: Session, year: int, month: int) -> dict:
    start, end = _get_month_range(year, month)

    pos_revenue = _pos_revenue_in_range(db, start, end)
    legacy_revenue = _legacy_revenue_in_range(db, start, end)
    total_revenue = pos_revenue + legacy_revenue

    expenses = _expenses_in_range(db, start, end)
    purchases = _purchases_in_range(db, start, end)
    outstanding = _outstanding_credit_in_range(db, start, end)

    final_profit = total_revenue - expenses - purchases

    donation = get_donation_settings(db)
    donation_amount = final_profit * (donation["percentage"] / 100) if donation["enabled"] and final_profit > 0 else 0.0
    profit_after_donation = final_profit - donation_amount

    from backend.models.user import User
    agreements = (
        db.query(PartnerAgreement, User)
        .join(User, User.id == PartnerAgreement.user_id)
        .filter(
            PartnerAgreement.agreement_start_date < end,
            PartnerAgreement.agreement_end_date.is_(None) | (PartnerAgreement.agreement_end_date >= start),
            PartnerAgreement.status.in_(["active", "ended"]),
        )
        .order_by(User.name.asc())
        .all()
    )

    partner_distribution = []
    for pa, user in agreements:
        amount = profit_after_donation * (pa.profit_share_percent / 100)
        partner_distribution.append({
            "user_id": user.id,
            "name": user.name,
            "profit_share_percent": pa.profit_share_percent,
            "has_investment": pa.has_investment,
            "investment_amount": pa.investment_amount,
            "amount": round(amount, 2),
        })

    return {
        "period": {"year": year, "month": month},
        "revenue": round(total_revenue, 2),
        "pos_revenue": round(pos_revenue, 2),
        "legacy_revenue": round(legacy_revenue, 2),
        "expenses": round(expenses, 2),
        "purchases": round(purchases, 2),
        "outstanding_credit": round(outstanding, 2) if outstanding > 0 else 0,
        "final_profit": round(final_profit, 2),
        "donation_enabled": donation["enabled"],
        "donation_percentage": donation["percentage"],
        "donation_amount": round(donation_amount, 2),
        "profit_after_donation": round(profit_after_donation, 2),
        "partner_count": len(agreements),
        "partner_distribution": partner_distribution,
    }


def get_weekly_breakdown(db: Session, year: int, month: int) -> list[dict]:
    weeks = _get_week_ranges(year, month)
    weekly_data = []
    for w in weeks:
        pos_rev = _pos_revenue_in_range(db, w["start"], w["end"])
        leg_rev = _legacy_revenue_in_range(db, w["start"], w["end"])
        expenses = _expenses_in_range(db, w["start"], w["end"])
        purchases = _purchases_in_range(db, w["start"], w["end"])
        total_rev = pos_rev + leg_rev
        weekly_data.append({
            "week": w["week"],
            "week_start": w["start"].isoformat(),
            "week_end": (w["end"] - datetime.timedelta(days=1)).isoformat() if w["end"] > w["start"] else w["start"].isoformat(),
            "revenue": round(total_rev, 2),
            "expenses": round(expenses, 2),
            "purchases": round(purchases, 2),
            "profit": round(total_rev - expenses - purchases, 2),
        })
    return weekly_data


def get_monthly_trend(db: Session, months: int = 12) -> list[dict]:
    today = date.today()
    trend = []
    for i in range(months - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        _, last_day = monthrange(y, m)
        m_start = date(y, m, 1)
        if m == 12:
            m_end = date(y + 1, 1, 1)
        else:
            m_end = date(y, m + 1, 1)
        pos_rev = _pos_revenue_in_range(db, m_start, m_end)
        leg_rev = _legacy_revenue_in_range(db, m_start, m_end)
        expenses = _expenses_in_range(db, m_start, m_end)
        purchases = _purchases_in_range(db, m_start, m_end)
        total_rev = pos_rev + leg_rev
        trend.append({
            "year": y,
            "month": m,
            "label": f"{y}-{m:02d}",
            "revenue": round(total_rev, 2),
            "expenses": round(expenses, 2),
            "purchases": round(purchases, 2),
            "profit": round(total_rev - expenses - purchases, 2),
        })
    return trend
