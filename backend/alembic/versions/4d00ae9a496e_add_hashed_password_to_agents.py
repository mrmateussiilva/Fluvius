"""add hashed_password to agents

Revision ID: 4d00ae9a496e
Revises: d6f8e7a4b2c1
Create Date: 2026-05-17 17:09:04.941088

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d00ae9a496e'
down_revision: Union[str, Sequence[str], None] = 'd6f8e7a4b2c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('agents')]
    if 'hashed_password' not in columns:
        with op.batch_alter_table('agents', schema=None) as batch_op:
            batch_op.add_column(sa.Column('hashed_password', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('agents')]
    if 'hashed_password' in columns:
        with op.batch_alter_table('agents', schema=None) as batch_op:
            batch_op.drop_column('hashed_password')
