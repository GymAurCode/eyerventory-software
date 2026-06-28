"""add_is_system_to_coa_accounts

Revision ID: 9a538d6b757e
Revises: 286a32307c5d
Create Date: 2026-06-27 15:52:46.892770

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a538d6b757e'
down_revision: Union[str, Sequence[str], None] = '286a32307c5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("warehouse_coa_accounts") as batch_op:
        batch_op.add_column(sa.Column("is_system", sa.Integer(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("warehouse_coa_accounts") as batch_op:
        batch_op.drop_column("description")
        batch_op.drop_column("is_system")
