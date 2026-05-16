"""add_ai_bot_fields_to_inbox

Revision ID: c5ead3307eb8
Revises: b2a4d8c1e7f0
Create Date: 2026-05-16 18:42:23.119300

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5ead3307eb8'
down_revision: Union[str, Sequence[str], None] = 'b2a4d8c1e7f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('inboxes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bot_type', sa.String(), nullable=False, server_default='menu'))
        batch_op.add_column(sa.Column('ai_instructions', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('inboxes', schema=None) as batch_op:
        batch_op.drop_column('ai_instructions')
        batch_op.drop_column('bot_type')
