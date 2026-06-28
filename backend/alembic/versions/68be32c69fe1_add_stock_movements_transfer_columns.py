"""add_stock_movements_transfer_columns

Revision ID: 68be32c69fe1
Revises: 738d55dd5c54
Create Date: 2026-06-27 14:55:39.005645

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68be32c69fe1'
down_revision: Union[str, Sequence[str], None] = '738d55dd5c54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add from_warehouse_id / to_warehouse_id columns to stock_movements."""
    with op.batch_alter_table("stock_movements", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("from_warehouse_id", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("to_warehouse_id", sa.Integer(), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_stock_movements_from_warehouse",
            "warehouses",
            ["from_warehouse_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_stock_movements_to_warehouse",
            "warehouses",
            ["to_warehouse_id"],
            ["id"],
        )


def downgrade() -> None:
    """Drop from_warehouse_id / to_warehouse_id columns."""
    with op.batch_alter_table("stock_movements", schema=None) as batch_op:
        batch_op.drop_constraint("fk_stock_movements_from_warehouse", type_="foreignkey")
        batch_op.drop_constraint("fk_stock_movements_to_warehouse", type_="foreignkey")
        batch_op.drop_column("to_warehouse_id")
        batch_op.drop_column("from_warehouse_id")
