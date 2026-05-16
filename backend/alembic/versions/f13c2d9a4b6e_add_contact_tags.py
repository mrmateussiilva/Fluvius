"""add_contact_tags

Revision ID: f13c2d9a4b6e
Revises: 9c7c0a7e8f1b
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f13c2d9a4b6e"
down_revision: Union[str, Sequence[str], None] = "9c7c0a7e8f1b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("contacts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("tags", sa.JSON(), nullable=True))

    op.execute("UPDATE contacts SET tags = '[]' WHERE tags IS NULL")

    with op.batch_alter_table("contacts", schema=None) as batch_op:
        batch_op.alter_column("tags", existing_type=sa.JSON(), nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("contacts", schema=None) as batch_op:
        batch_op.drop_column("tags")
