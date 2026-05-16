"""add_inbox_is_active

Revision ID: b2a4d8c1e7f0
Revises: f13c2d9a4b6e
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2a4d8c1e7f0"
down_revision: Union[str, Sequence[str], None] = "f13c2d9a4b6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("inboxes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("inboxes", schema=None) as batch_op:
        batch_op.drop_column("is_active")
