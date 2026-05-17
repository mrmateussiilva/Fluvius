"""add welcome_message and default_bot_active to inboxes

Revision ID: 7cf34bd95ba5
Revises: 4d00ae9a496e
Create Date: 2026-05-17 17:17:55.568605

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7cf34bd95ba5'
down_revision: Union[str, Sequence[str], None] = '4d00ae9a496e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('inboxes')]
    with op.batch_alter_table('inboxes', schema=None) as batch_op:
        if 'welcome_message' not in columns:
            batch_op.add_column(sa.Column('welcome_message', sa.String(), nullable=True))
        if 'default_bot_active' not in columns:
            batch_op.add_column(sa.Column('default_bot_active', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('inboxes')]
    with op.batch_alter_table('inboxes', schema=None) as batch_op:
        if 'welcome_message' in columns:
            batch_op.drop_column('welcome_message')
        if 'default_bot_active' in columns:
            batch_op.drop_column('default_bot_active')
