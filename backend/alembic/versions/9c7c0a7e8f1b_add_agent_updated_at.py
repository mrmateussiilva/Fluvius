"""add_agent_updated_at

Revision ID: 9c7c0a7e8f1b
Revises: 60ae49e97f99
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c7c0a7e8f1b"
down_revision: Union[str, Sequence[str], None] = "60ae49e97f99"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("agents", schema=None) as batch_op:
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.execute("UPDATE agents SET updated_at = created_at WHERE updated_at IS NULL")

    with op.batch_alter_table("agents", schema=None) as batch_op:
        batch_op.alter_column("updated_at", existing_type=sa.DateTime(), nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("agents", schema=None) as batch_op:
        batch_op.drop_column("updated_at")
