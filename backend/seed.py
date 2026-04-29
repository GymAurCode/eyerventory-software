"""
Database seeding for default data.

Runs after migrations to ensure default users and chart of accounts exist.
Safe to run multiple times (idempotent).
"""

import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.security import get_password_hash
from backend.database import SessionLocal, engine
from backend.models import OwnerShare, User

logger = logging.getLogger("inventory-seed")


def seed_default_users() -> None:
    """Create default owner and staff users if they don't exist."""
    db: Session = SessionLocal()
    try:
        defaults = [
            {"name": "Owner Admin", "email": "owner@eyerflow.com", "password": "owner123", "role": "owner"},
            {"name": "Staff User", "email": "staff@eyerflow.com", "password": "staff123", "role": "staff"},
        ]
        for item in defaults:
            user = db.query(User).filter(User.email == item["email"]).first()
            if not user:
                db.add(
                    User(
                        username=item["email"],
                        name=item["name"],
                        email=item["email"],
                        hashed_password=get_password_hash(item["password"]),
                        role=item["role"],
                        status="active",
                        is_active=True,
                    )
                )
                logger.info("Created default user: %s", item["email"])

        db.flush()

        # Ensure all owners have an OwnerShare record
        owners = db.query(User).filter(User.role == "owner").all()
        for owner in owners:
            if not db.query(OwnerShare).filter(OwnerShare.user_id == owner.id).first():
                db.add(OwnerShare(user_id=owner.id, ownership_percentage=100.0 / len(owners)))
                logger.info("Created OwnerShare for user: %s", owner.email)

        db.commit()
    finally:
        db.close()


def seed_chart_of_accounts() -> None:
    """Ensure default Chart of Accounts exists."""
    with engine.begin() as conn:
        # Check if accounts table exists
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
        if "accounts" not in tables:
            logger.warning("Accounts table does not exist — skipping COA seeding")
            return

        default_accounts = [
            ("Cash on Hand", "asset"),
            ("Bank", "asset"),
            ("Accounts Receivable", "asset"),
            ("Inventory", "asset"),
            ("Accounts Payable", "liability"),
            ("Salary Payable", "liability"),
            ("Owner Equity", "equity"),
            ("Retained Earnings", "equity"),
            ("Sales Revenue", "revenue"),
            ("Cost of Goods Sold", "expense"),
            ("Salaries Expense", "expense"),
            ("Other Expenses", "expense"),
        ]

        for name, acc_type in default_accounts:
            existing = conn.execute(
                text("SELECT id FROM accounts WHERE name = :name"),
                {"name": name}
            ).fetchone()
            if not existing:
                conn.execute(
                    text("INSERT INTO accounts (name, type) VALUES (:name, :type)"),
                    {"name": name, "type": acc_type}
                )
                logger.info("Seeded account: %s (%s)", name, acc_type)

    logger.info("Chart of Accounts seeded.")


def run_seeds() -> None:
    """Entry point — call this once at app startup after migrations."""
    seed_default_users()
    seed_chart_of_accounts()
    logger.info("All seeds complete.")
