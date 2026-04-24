import logging
from sqlalchemy import text
from backend.database import engine

logger = logging.getLogger("inventory-db-init")

def apply_startup_migrations():
    """
    Safely applies database migrations on app startup.
    Checks for missing columns/tables and adds them without breaking existing data.
    """
    try:
        with engine.begin() as conn:
            # Users table migrations
            user_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
            if "name" not in user_columns:
                logger.info("Adding 'name' column to users table")
                conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR(120)"))
            if "email" not in user_columns:
                logger.info("Adding 'email' column to users table")
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(120)"))
            if "status" not in user_columns:
                logger.info("Adding 'status' column to users table")
                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'"))
            
            # Update existing users with defaults
            conn.execute(text("UPDATE users SET name = COALESCE(name, username, 'User') WHERE name IS NULL"))
            conn.execute(text("UPDATE users SET email = COALESCE(email, username || '@inventory.local') WHERE email IS NULL"))
            conn.execute(text("UPDATE users SET status = COALESCE(status, 'active') WHERE status IS NULL"))
            
            # Products table migrations
            product_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(products)")).fetchall()]
            if "image_data" not in product_columns:
                logger.info("Adding 'image_data' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN image_data TEXT"))
            if "image_mime" not in product_columns:
                logger.info("Adding 'image_mime' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN image_mime VARCHAR(32)"))
            if "stock" not in product_columns:  # Example: add stock column if missing
                logger.info("Adding 'stock' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0"))
            
            # Add more migrations here as needed
            # Example for sales table
            # sales_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(sales)")).fetchall()]
            # if "new_column" not in sales_columns:
            #     conn.execute(text("ALTER TABLE sales ADD COLUMN new_column TYPE"))

            # HR Module: ensure tables exist (created by SQLAlchemy, but add any future columns here)
            _apply_hr_migrations(conn)
            
            # Accounting Module: ensure chart of accounts is seeded
            _seed_chart_of_accounts(conn)
            
            # Migrate default user emails from @inventory.local → @eyerflow.com
            _migrate_default_emails(conn)

        logger.info("Database migrations applied successfully")
    except Exception as e:
        logger.error(f"Database migration failed: {e}")
        raise


def _migrate_default_emails(conn):
    """
    Safely renames legacy default emails to the new domain.
    - Only touches rows that still have the old email.
    - Never changes passwords or any other field.
    - Skips if already migrated.
    """
    migrations = [
        ("owner@inventory.local", "owner@eyerflow.com", "owner"),
        ("staff@inventory.local", "staff@eyerflow.com", "staff"),
    ]

    for old_email, new_email, role in migrations:
        old_user = conn.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": old_email}
        ).fetchone()

        if old_user:
            # Check the new email isn't already taken by a different user
            conflict = conn.execute(
                text("SELECT id FROM users WHERE email = :e AND id != :id"),
                {"e": new_email, "id": old_user[0]},
            ).fetchone()

            if conflict:
                logger.warning(
                    f"Cannot migrate {old_email} → {new_email}: target email already exists on a different user"
                )
                continue

            conn.execute(
                text("UPDATE users SET email = :new, username = :new WHERE email = :old"),
                {"new": new_email, "old": old_email},
            )
            logger.info(f"{role.capitalize()} email updated: {old_email} → {new_email}")
        else:
            already = conn.execute(
                text("SELECT id FROM users WHERE email = :e"), {"e": new_email}
            ).fetchone()
            if already:
                logger.info(f"{role.capitalize()} email already updated ({new_email}), skipping")
            else:
                logger.info(f"{role.capitalize()} default user not found — will be seeded by seed_owner_user()")


def _apply_hr_migrations(conn):
    """Ensure HR tables have all required columns (safe to run on every startup)."""
    tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]

    if "employees" in tables:
        emp_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(employees)")).fetchall()]
        if "grace_minutes" not in emp_cols:
            conn.execute(text("ALTER TABLE employees ADD COLUMN grace_minutes INTEGER DEFAULT 10"))
        if "is_active" not in emp_cols:
            conn.execute(text("ALTER TABLE employees ADD COLUMN is_active BOOLEAN DEFAULT 1"))

    if "attendance_logs" in tables:
        att_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(attendance_logs)")).fetchall()]
        if "late_minutes" not in att_cols:
            conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN late_minutes INTEGER DEFAULT 0"))

    if "hr_payments" in tables:
        pay_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(hr_payments)")).fetchall()]
        if "is_reversed" not in pay_cols:
            conn.execute(text("ALTER TABLE hr_payments ADD COLUMN is_reversed INTEGER DEFAULT 0"))
        if "payroll_id" not in pay_cols:
            conn.execute(text("ALTER TABLE hr_payments ADD COLUMN payroll_id INTEGER"))

    logger.info("HR migrations applied")


def _seed_chart_of_accounts(conn):
    """Ensure default Chart of Accounts exists (safe to run on every startup)."""
    tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
    
    if "accounts" not in tables:
        # Table will be created by SQLAlchemy on startup
        return
    
    # Define default accounts
    default_accounts = [
        ("Cash on Hand", "asset"),
        ("Bank", "asset"),
        ("Salaries Expense", "expense"),
        ("Sales Revenue", "revenue"),
        ("Cost of Goods Sold", "expense"),
        ("Other Expenses", "expense"),
        ("Salary Payable", "liability"),
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
            logger.info(f"Seeded account: {name} ({acc_type})")
    
    logger.info("Chart of Accounts seeded")
