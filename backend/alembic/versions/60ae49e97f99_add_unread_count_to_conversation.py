"""add_unread_count_to_conversation

Revision ID: 60ae49e97f99
Revises: b086d2fa3e64
Create Date: 2026-05-07 11:23:46.740418

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60ae49e97f99'
down_revision: Union[str, Sequence[str], None] = 'b086d2fa3e64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('unread_count', sa.Integer(), nullable=False, server_default='0'))
        # Note: server_default is needed for non-nullable column addition in SQLite


def downgrade() -> None:
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        batch_op.drop_column('unread_count')
