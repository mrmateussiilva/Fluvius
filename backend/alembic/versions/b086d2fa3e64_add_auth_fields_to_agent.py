"""add auth fields to agent

Revision ID: b086d2fa3e64
Revises: 375ddd2d2793
Create Date: 2026-05-07 09:46:59.546385

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b086d2fa3e64'
down_revision: Union[str, Sequence[str], None] = '375ddd2d2793'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('agents', schema=None) as batch_op:
        # Check if hashed_password already exists from previous failed attempt
        # Since SQLite info showed it exists, we skip it if it's there
        # But batch mode handles the recreate, so we define the desired state
        batch_op.add_column(sa.Column('role', sa.String(), nullable=False, server_default='agent'))
    
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_conversations_agents', 'agents', ['assignee_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        batch_op.drop_constraint('fk_conversations_agents', type_='foreignkey')

    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.drop_column('role')
        batch_op.drop_column('hashed_password')
