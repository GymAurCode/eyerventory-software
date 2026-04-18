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