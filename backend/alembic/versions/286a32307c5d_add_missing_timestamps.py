"""add_missing_timestamps

Revision ID: 286a32307c5d
Revises: 68be32c69fe1
Create Date: 2026-06-27 15:18:50.606337

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '286a32307c5d'
down_revision: Union[str, Sequence[str], None] = '68be32c69fe1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # shops: add updated_at
    with op.batch_alter_table("shops") as batch_op:
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(timezone=True),
                           server_default=sa.func.now(), nullable=False))

    # warehouses: add updated_at
    with op.batch_alter_table("warehouses") as batch_op:
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(timezone=True),
                           server_default=sa.func.now(), nullable=False))

    # warehouse_coa_accounts: add created_at
    with op.batch_alter_table("warehouse_coa_accounts") as batch_op:
        batch_op.add_column(sa.Column("created_at", sa.DateTime(timezone=True),
                           server_default=sa.func.now(), nullable=False))

    # stock_ledger: add rate, value, notes
    with op.batch_alter_table("stock_ledger") as batch_op:
        batch_op.add_column(sa.Column("rate", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("value", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))

    # invoices: add created_at
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.add_column(sa.Column("created_at", sa.DateTime(timezone=True),
                           server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.drop_column("created_at")

    with op.batch_alter_table("stock_ledger") as batch_op:
        batch_op.drop_column("notes")
        batch_op.drop_column("value")
        batch_op.drop_column("rate")

    with op.batch_alter_table("warehouse_coa_accounts") as batch_op:
        batch_op.drop_column("created_at")

    with op.batch_alter_table("warehouses") as batch_op:
        batch_op.drop_column("updated_at")

    with op.batch_alter_table("shops") as batch_op:
        batch_op.drop_column("updated_at")
