"""add hashed_password to agents

Revision ID: 1c9d8e606fe1
Revises: 14e7b3f84b8a
Create Date: 2026-05-17 17:33:29.071355

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1c9d8e606fe1'
down_revision: Union[str, Sequence[str], None] = '14e7b3f84b8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Add hashed_password to agents
    agents_cols = [col['name'] for col in inspector.get_columns('agents')]
    if 'hashed_password' not in agents_cols:
        with op.batch_alter_table('agents', schema=None) as batch_op:
            batch_op.add_column(sa.Column('hashed_password', sa.String(), nullable=True))

    # 2. Add welcome_message to inboxes
    inboxes_cols = [col['name'] for col in inspector.get_columns('inboxes')]
    if 'welcome_message' not in inboxes_cols:
        with op.batch_alter_table('inboxes', schema=None) as batch_op:
            batch_op.add_column(sa.Column('welcome_message', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    agents_cols = [col['name'] for col in inspector.get_columns('agents')]
    if 'hashed_password' in agents_cols:
        with op.batch_alter_table('agents', schema=None) as batch_op:
            batch_op.drop_column('hashed_password')

    inboxes_cols = [col['name'] for col in inspector.get_columns('inboxes')]
    if 'welcome_message' in inboxes_cols:
        with op.batch_alter_table('inboxes', schema=None) as batch_op:
            batch_op.drop_column('welcome_message')
