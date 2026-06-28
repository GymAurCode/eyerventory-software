"""
Alembic environment configuration for Eyerventory Warehouse Module.

Integrates with the existing SQLAlchemy models defined in backend/models/.
Uses the project's database connection string from backend.database.
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure the backend package is importable (project root may not be on sys.path)
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# Alembic Config object
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import ALL models so Alembic can detect every table ─────────────────────
from backend.database import Base  # noqa: E402
from backend.models import *  # noqa: E402, F403 — registers all models with Base

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without connecting)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect to live DB)."""
    # Use the project's DATABASE_URL if the config doesn't have one
    sqlalchemy_url = config.get_main_option("sqlalchemy.url")
    if not sqlalchemy_url or sqlalchemy_url == "driver://user:pass@localhost/dbname":
        from backend.database import DATABASE_URL
        config.set_main_option("sqlalchemy.url", DATABASE_URL)

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # required for SQLite ALTER TABLE support
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
