"""
Migration runner for EyerFlow.

How it works:
- On startup, ensures a `migrations` tracking table exists.
- Scans backend/migrations/*.sql in filename order.
- Runs only files not yet recorded in the `migrations` table.
- Each SQL file is executed statement-by-statement inside a transaction.
- ALTER TABLE duplicate-column errors are silently ignored (idempotent).
- Any other error aborts that migration and re-raises so startup fails loudly.
"""

import logging
import os
import re
from pathlib import Path

from sqlalchemy import text

from backend.database import engine

logger = logging.getLogger("inventory-migrate")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

# SQLite error message when a column already exists
_DUPLICATE_COLUMN_MSG = "duplicate column name"


def _ensure_migrations_table(conn) -> None:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS migrations (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    VARCHAR(255) UNIQUE NOT NULL,
            run_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """))


def _applied_migrations(conn) -> set:
    rows = conn.execute(text("SELECT name FROM migrations")).fetchall()
    return {row[0] for row in rows}


def _split_statements(sql: str) -> list[str]:
    """Split a SQL file into individual statements, stripping comments."""
    # Remove single-line comments
    sql = re.sub(r"--[^\n]*", "", sql)
    statements = [s.strip() for s in sql.split(";")]
    return [s for s in statements if s]


def run_migrations() -> None:
    """Entry point — call this once at app startup."""
    if not MIGRATIONS_DIR.exists():
        logger.warning("Migrations directory not found: %s — skipping", MIGRATIONS_DIR)
        return

    migration_files = sorted(
        f for f in MIGRATIONS_DIR.iterdir()
        if f.suffix == ".sql" and f.name != ".gitkeep"
    )

    if not migration_files:
        logger.info("No migration files found.")
        return

    with engine.begin() as conn:
        _ensure_migrations_table(conn)
        applied = _applied_migrations(conn)

        for migration_file in migration_files:
            name = migration_file.name

            if name in applied:
                logger.debug("Migration already applied: %s", name)
                continue

            logger.info("Applying migration: %s", name)
            sql = migration_file.read_text(encoding="utf-8")
            statements = _split_statements(sql)

            for statement in statements:
                try:
                    conn.execute(text(statement))
                except Exception as exc:
                    # Ignore "duplicate column name" — ALTER TABLE is not idempotent in SQLite
                    if _DUPLICATE_COLUMN_MSG in str(exc).lower():
                        logger.debug("Column already exists (skipping): %s", statement[:80])
                        continue
                    logger.error("Migration %s failed on statement:\n%s\nError: %s", name, statement, exc)
                    raise

            conn.execute(
                text("INSERT INTO migrations (name) VALUES (:name)"),
                {"name": name},
            )
            logger.info("Migration applied: %s", name)

    logger.info("All migrations complete.")
