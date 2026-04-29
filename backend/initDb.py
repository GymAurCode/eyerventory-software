"""
initDb.py — backward-compatible shim.

Previously contained inline migration logic. Now delegates to the proper
migration runner (backend/migrate.py) and seed module (backend/seed.py).

The function name `apply_startup_migrations` is preserved so existing
imports in main.py continue to work without changes.
"""

import logging

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
        run_migrations()
    except Exception as exc:
        logger.error("Migration runner failed: %s", exc)
        raise

    try:
        run_seeds()
    except Exception as exc:
        # Seed failures are logged but do NOT crash the app —
        # the app is still usable without default seed data.
        logger.error("Seed runner failed (non-fatal): %s", exc)
