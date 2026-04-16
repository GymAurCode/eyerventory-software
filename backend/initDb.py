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
            
        logger.info("Database migrations applied successfully")
    except Exception as e:
        logger.error(f"Database migration failed: {e}")
        raise</content>
<parameter name="filePath">d:\inventory-software\backend\initDb.py