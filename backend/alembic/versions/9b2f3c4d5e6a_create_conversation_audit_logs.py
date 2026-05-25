"""create conversation audit logs

Revision ID: 9b2f3c4d5e6a
Revises: 8a7d2e4c9b1f
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b2f3c4d5e6a"
down_revision: Union[str, Sequence[str], None] = "8a7d2e4c9b1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversation_audit_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("workspace_id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("actor_agent_id", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_conversation_audit_logs_action"), "conversation_audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_conversation_audit_logs_actor_agent_id"), "conversation_audit_logs", ["actor_agent_id"], unique=False)
    op.create_index(op.f("ix_conversation_audit_logs_conversation_id"), "conversation_audit_logs", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_conversation_audit_logs_id"), "conversation_audit_logs", ["id"], unique=False)
    op.create_index(op.f("ix_conversation_audit_logs_workspace_id"), "conversation_audit_logs", ["workspace_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_conversation_audit_logs_workspace_id"), table_name="conversation_audit_logs")
    op.drop_index(op.f("ix_conversation_audit_logs_id"), table_name="conversation_audit_logs")
    op.drop_index(op.f("ix_conversation_audit_logs_conversation_id"), table_name="conversation_audit_logs")
    op.drop_index(op.f("ix_conversation_audit_logs_actor_agent_id"), table_name="conversation_audit_logs")
    op.drop_index(op.f("ix_conversation_audit_logs_action"), table_name="conversation_audit_logs")
    op.drop_table("conversation_audit_logs")
