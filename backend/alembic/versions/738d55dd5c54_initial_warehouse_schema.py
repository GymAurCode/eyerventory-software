"""initial_warehouse_schema

Baseline migration — empty, safe, no-op.

This migration exists solely as a version marker. All tables are created
at startup by Base.metadata.create_all() plus the custom SQL migration
runner (backend/migrate.py). Alembic is used only for tracking future
schema changes on top of the current state.

Revision ID: 738d55dd5c54
Revises:
Create Date: 2026-06-27 14:54:03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "738d55dd5c54"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline — no schema changes needed (tables created by create_all)."""
    pass


def downgrade() -> None:
    """No-op reverse."""
    pass
