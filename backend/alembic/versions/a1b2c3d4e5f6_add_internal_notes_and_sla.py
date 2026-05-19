"""add internal notes and sla to queues

Revision ID: a1b2c3d4e5f6
Revises: 14e7b3f84b8a
Create Date: 2026-05-19 11:28:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '1c9d8e606fe1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # --- messages: is_internal + author_agent_id ---
    msg_cols = [col['name'] for col in inspector.get_columns('messages')]
    with op.batch_alter_table('messages', schema=None) as batch_op:
        if 'is_internal' not in msg_cols:
            batch_op.add_column(
                sa.Column('is_internal', sa.Boolean(), nullable=False, server_default=sa.false())
            )
        if 'author_agent_id' not in msg_cols:
            batch_op.add_column(
                sa.Column('author_agent_id', sa.String(), nullable=True)
            )
            batch_op.create_foreign_key(
                'fk_messages_author_agent_id', 'agents', ['author_agent_id'], ['id']
            )

    # --- queues: sla_minutes ---
    if 'queues' in inspector.get_table_names():
        queue_cols = [col['name'] for col in inspector.get_columns('queues')]
        with op.batch_alter_table('queues', schema=None) as batch_op:
            if 'sla_minutes' not in queue_cols:
                batch_op.add_column(
                    sa.Column('sla_minutes', sa.Integer(), nullable=True, server_default='30')
                )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'queues' in inspector.get_table_names():
        queue_cols = [col['name'] for col in inspector.get_columns('queues')]
        with op.batch_alter_table('queues', schema=None) as batch_op:
            if 'sla_minutes' in queue_cols:
                batch_op.drop_column('sla_minutes')

    msg_cols = [col['name'] for col in inspector.get_columns('messages')]
    with op.batch_alter_table('messages', schema=None) as batch_op:
        if 'author_agent_id' in msg_cols:
            batch_op.drop_constraint('fk_messages_author_agent_id', type_='foreignkey')
            batch_op.drop_column('author_agent_id')
        if 'is_internal' in msg_cols:
            batch_op.drop_column('is_internal')
