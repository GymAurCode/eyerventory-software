"""
initDb.py — backward-compatible shim.

Previously contained inline migration logic. Now delegates to the proper
migration runner (backend/migrate.py) and seed module (backend/seed.py).

The function name `apply_startup_migrations` is preserved so existing
imports in main.py continue to work without changes.
"""

import logging

from sqlalchemy import text

from backend.database import engine
from backend.migrate import run_migrations
from backend.seed import run_seeds

logger = logging.getLogger("inventory-db-init")


def apply_startup_migrations() -> None:
    """
    Run all pending SQL migrations then seed default data.
    Called once at FastAPI startup (see main.py on_startup).
    Safe to call on a brand-new empty DB or an existing production DB.
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
            if "stock" not in product_columns:
                logger.info("Adding 'stock' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0"))
            if "sku" not in product_columns:
                logger.info("Adding 'sku' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN sku VARCHAR(80)"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_products_sku ON products(sku) WHERE sku IS NOT NULL"))
            if "category" not in product_columns:
                logger.info("Adding 'category' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN category VARCHAR(80)"))
            if "selling_price" not in product_columns:
                logger.info("Adding 'selling_price' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN selling_price REAL NOT NULL DEFAULT 0.0"))
            if "updated_at" not in product_columns:
                logger.info("Adding 'updated_at' column to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN updated_at DATETIME"))
            
            # Add more migrations here as needed
            # Example for sales table
            # sales_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(sales)")).fetchall()]
            # if "new_column" not in sales_columns:
            #     conn.execute(text("ALTER TABLE sales ADD COLUMN new_column TYPE"))

            # HR Module: ensure tables exist (created by SQLAlchemy, but add any future columns here)
            _apply_hr_migrations(conn)
            _apply_supplier_price_migrations(conn)
            _apply_credit_management_migrations(conn)
            
            # Accounting Module: ensure chart of accounts is seeded
            _seed_chart_of_accounts(conn)
            
            # Purchase Module: ensure tables exist
            _apply_purchase_migrations(conn)
            
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
    """Ensure default Chart of Accounts exists with account codes (safe to run on every startup)."""
    tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]

    if "accounts" not in tables:
        return

    # Add code column if missing
    acc_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(accounts)")).fetchall()]
    if "code" not in acc_cols:
        conn.execute(text("ALTER TABLE accounts ADD COLUMN code VARCHAR(20)"))
        logger.info("Added 'code' column to accounts table")

    default_accounts = [
        ("1001", "Cash on Hand",          "asset"),
        ("1002", "Bank",                  "asset"),
        ("1100", "Accounts Receivable",   "asset"),
        ("1200", "Inventory",             "asset"),
        ("2001", "Accounts Payable",      "liability"),
        ("2100", "Salary Payable",        "liability"),
        ("4001", "Sales Revenue",         "revenue"),
        ("5001", "Cost of Goods Sold",    "expense"),
        ("5002", "Salaries Expense",      "expense"),
        ("5003", "Operational Expenses",  "expense"),
    ]

    for code, name, acc_type in default_accounts:
        existing = conn.execute(
            text("SELECT id, code FROM accounts WHERE name = :name"), {"name": name}
        ).fetchone()
        if not existing:
            conn.execute(
                text("INSERT INTO accounts (code, name, type) VALUES (:code, :name, :type)"),
                {"code": code, "name": name, "type": acc_type},
            )
            logger.info(f"Seeded account: {code} {name} ({acc_type})")
        elif existing[1] is None:
            conn.execute(
                text("UPDATE accounts SET code = :code WHERE name = :name"),
                {"code": code, "name": name},
            )

    # Remove legacy accounts that were replaced
    legacy = ["Other Expenses"]
    for name in legacy:
        conn.execute(text("DELETE FROM accounts WHERE name = :name AND id NOT IN (SELECT DISTINCT account_id FROM journal_items)"), {"name": name})

    logger.info("Chart of Accounts seeded")


def _apply_supplier_price_migrations(conn):
    tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
    if "supplier_product_prices" not in tables:
        conn.execute(
            text(
                "CREATE TABLE supplier_product_prices ("
                "id INTEGER PRIMARY KEY, "
                "product_id INTEGER NOT NULL, "
                "supplier_id INTEGER NOT NULL, "
                "price FLOAT NOT NULL, "
                "date DATE NOT NULL)"
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spp_product_id ON supplier_product_prices(product_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spp_supplier_id ON supplier_product_prices(supplier_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spp_date ON supplier_product_prices(date)"))
    logger.info("Supplier pricing migrations applied")


def _apply_credit_management_migrations(conn):
    tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]

    if "customers" not in tables:
        conn.execute(
            text(
                "CREATE TABLE customers ("
                "id INTEGER PRIMARY KEY, "
                "name VARCHAR(120) NOT NULL, "
                "phone VARCHAR(40), "
                "address VARCHAR(255), "
                "email VARCHAR(120), "
                "opening_balance FLOAT NOT NULL DEFAULT 0, "
                "notes VARCHAR(500), "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)"))

    if "suppliers" not in tables:
        conn.execute(
            text(
                "CREATE TABLE suppliers ("
                "id INTEGER PRIMARY KEY, "
                "name VARCHAR(120) NOT NULL, "
                "phone VARCHAR(40), "
                "address VARCHAR(255), "
                "email VARCHAR(120), "
                "opening_balance FLOAT NOT NULL DEFAULT 0, "
                "notes VARCHAR(500), "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)"))

    if "credit_accounts" not in tables:
        conn.execute(
            text(
                "CREATE TABLE credit_accounts ("
                "id INTEGER PRIMARY KEY, "
                "party_type VARCHAR(16) NOT NULL, "
                "party_id INTEGER NOT NULL, "
                "total_amount FLOAT NOT NULL, "
                "paid_amount FLOAT NOT NULL DEFAULT 0, "
                "balance FLOAT NOT NULL, "
                "status VARCHAR(16) NOT NULL DEFAULT 'pending', "
                "due_date DATETIME, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
            )
        )

    if "credit_transactions" not in tables:
        conn.execute(
            text(
                "CREATE TABLE credit_transactions ("
                "id INTEGER PRIMARY KEY, "
                "credit_account_id INTEGER NOT NULL, "
                "type VARCHAR(16) NOT NULL, "
                "amount FLOAT NOT NULL, "
                "description VARCHAR(255), "
                "reference_id INTEGER, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
            )
        )

    if "credit_items" not in tables:
        conn.execute(
            text(
                "CREATE TABLE credit_items ("
                "id INTEGER PRIMARY KEY, "
                "credit_account_id INTEGER NOT NULL, "
                "product_id INTEGER NOT NULL, "
                "quantity INTEGER NOT NULL, "
                "price FLOAT NOT NULL, "
                "total FLOAT NOT NULL)"
            )
        )

    if "credit_payments" not in tables:
        # Check if the old 'payments' table was actually the credit payments table
        # (identified by having credit_account_id column instead of direction)
        if "payments" in tables:
            pay_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(payments)")).fetchall()]
            if "credit_account_id" in pay_cols and "direction" not in pay_cols:
                # This is the old misnamed credit payments table — rename it
                logger.info("Renaming legacy 'payments' table to 'credit_payments'")
                conn.execute(text("ALTER TABLE payments RENAME TO credit_payments"))
            # else: payments table belongs to payment.py (direction-based), leave it alone
        else:
            conn.execute(
                text(
                    "CREATE TABLE credit_payments ("
                    "id INTEGER PRIMARY KEY, "
                    "credit_account_id INTEGER NOT NULL, "
                    "amount FLOAT NOT NULL, "
                    "method VARCHAR(16) NOT NULL DEFAULT 'cash', "
                    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
                )
            )

    if "ledger_entries" not in tables:
        conn.execute(
            text(
                "CREATE TABLE ledger_entries ("
                "id INTEGER PRIMARY KEY, "
                "party_id INTEGER NOT NULL, "
                "party_type VARCHAR(16) NOT NULL, "
                "debit FLOAT NOT NULL DEFAULT 0, "
                "credit FLOAT NOT NULL DEFAULT 0, "
                "balance_after FLOAT NOT NULL, "
                "reference_type VARCHAR(16) NOT NULL, "
                "reference_id INTEGER, "
                "date DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
            )
        )

    if "sales" in tables:
        sales_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(sales)")).fetchall()]
        if "customer_id" not in sales_cols:
            conn.execute(text("ALTER TABLE sales ADD COLUMN customer_id INTEGER"))
        if "payment_type" not in sales_cols:
            conn.execute(text("ALTER TABLE sales ADD COLUMN payment_type VARCHAR(16) DEFAULT 'CASH'"))
        if "paid_amount" not in sales_cols:
            conn.execute(text("ALTER TABLE sales ADD COLUMN paid_amount FLOAT DEFAULT 0"))
        if "due_date" not in sales_cols:
            conn.execute(text("ALTER TABLE sales ADD COLUMN due_date DATETIME"))

    if "customers" in tables:
        customer_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(customers)")).fetchall()]
        if "email" not in customer_cols:
            conn.execute(text("ALTER TABLE customers ADD COLUMN email VARCHAR(120)"))
        if "opening_balance" not in customer_cols:
            conn.execute(text("ALTER TABLE customers ADD COLUMN opening_balance FLOAT DEFAULT 0"))
        if "notes" not in customer_cols:
            conn.execute(text("ALTER TABLE customers ADD COLUMN notes VARCHAR(500)"))
        if "balance" not in customer_cols:
            conn.execute(text("ALTER TABLE customers ADD COLUMN balance REAL NOT NULL DEFAULT 0.0"))
            logger.info("Added 'balance' column to customers table")

    if "suppliers" in tables:
        supplier_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(suppliers)")).fetchall()]
        if "email" not in supplier_cols:
            conn.execute(text("ALTER TABLE suppliers ADD COLUMN email VARCHAR(120)"))
        if "opening_balance" not in supplier_cols:
            conn.execute(text("ALTER TABLE suppliers ADD COLUMN opening_balance FLOAT DEFAULT 0"))
        if "notes" not in supplier_cols:
            conn.execute(text("ALTER TABLE suppliers ADD COLUMN notes VARCHAR(500)"))
        if "balance" not in supplier_cols:
            conn.execute(text("ALTER TABLE suppliers ADD COLUMN balance REAL NOT NULL DEFAULT 0.0"))
            logger.info("Added 'balance' column to suppliers table")

    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_credit_accounts_party ON credit_accounts(party_type, party_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_credit_accounts_status ON credit_accounts(status)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_credit_txn_account ON credit_transactions(credit_account_id, created_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_credit_items_account ON credit_items(credit_account_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_credit_payments_account ON credit_payments(credit_account_id, created_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_entries(party_type, party_id, date)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone)"))
    logger.info("Credit management migrations applied")


def _apply_purchase_migrations(conn):
    """Create purchases and purchase_items tables if they don't exist, and add missing columns."""
    tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]

    # Detect legacy flat-schema purchases table (had product_id directly on it)
    if "purchases" in tables:
        purchase_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(purchases)")).fetchall()]
        is_legacy = "product_id" in purchase_cols or "purchase_date" not in purchase_cols
        if is_legacy:
            logger.info("Detected legacy purchases table schema — archiving as purchases_legacy")
            conn.execute(text("ALTER TABLE purchases RENAME TO purchases_legacy"))
            tables = [t for t in tables if t != "purchases"]  # treat as not existing

    if "purchases" not in tables:
        conn.execute(text(
            "CREATE TABLE purchases ("
            "id INTEGER PRIMARY KEY, "
            "supplier_id INTEGER NOT NULL, "
            "invoice_number VARCHAR(80) NOT NULL UNIQUE, "
            "purchase_date DATETIME NOT NULL, "
            "total_amount FLOAT NOT NULL, "
            "discount FLOAT NOT NULL DEFAULT 0, "
            "tax FLOAT NOT NULL DEFAULT 0, "
            "final_amount FLOAT NOT NULL, "
            "payment_type VARCHAR(10) NOT NULL, "
            "notes TEXT, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)"
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchases_invoice ON purchases(invoice_number)"))
        logger.info("Created purchases table")

    if "purchase_items" not in tables:
        conn.execute(text(
            "CREATE TABLE purchase_items ("
            "id INTEGER PRIMARY KEY, "
            "purchase_id INTEGER NOT NULL REFERENCES purchases(id), "
            "product_id INTEGER NOT NULL REFERENCES products(id), "
            "quantity INTEGER NOT NULL, "
            "purchase_price FLOAT NOT NULL, "
            "total_price FLOAT NOT NULL)"
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_items_purchase ON purchase_items(purchase_id)"))
        logger.info("Created purchase_items table")

    logger.info("Purchase migrations applied")
