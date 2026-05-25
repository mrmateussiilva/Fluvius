"""add message external id idempotency index

Revision ID: 8a7d2e4c9b1f
Revises: 4ec92c3414de
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a7d2e4c9b1f"
down_revision: Union[str, Sequence[str], None] = "4ec92c3414de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "uq_messages_conversation_external_message_id"


def upgrade() -> None:
    bind = op.get_bind()

    duplicate_ids = bind.execute(sa.text("""
        SELECT m.id
        FROM messages m
        WHERE m.external_message_id IS NOT NULL
          AND m.id NOT IN (
            SELECT MIN(id)
            FROM messages
            WHERE external_message_id IS NOT NULL
            GROUP BY conversation_id, external_message_id
          )
          AND EXISTS (
            SELECT 1
            FROM messages m2
            WHERE m2.conversation_id = m.conversation_id
              AND m2.external_message_id = m.external_message_id
              AND m2.id != m.id
          )
    """)).fetchall()

    for (message_id,) in duplicate_ids:
        bind.execute(
            sa.text("UPDATE messages SET external_message_id = NULL WHERE id = :id"),
            {"id": message_id},
        )

    op.create_index(
        INDEX_NAME,
        "messages",
        ["conversation_id", "external_message_id"],
        unique=True,
        sqlite_where=sa.text("external_message_id IS NOT NULL"),
        postgresql_where=sa.text("external_message_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="messages")
