"""auto detect missing columns and tables

Revision ID: 14e7b3f84b8a
Revises: 7cf34bd95ba5
Create Date: 2026-05-17 17:23:04.058784

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14e7b3f84b8a'
down_revision: Union[str, Sequence[str], None] = '7cf34bd95ba5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create 'queues' table if it doesn't exist
    if 'queues' not in tables:
        op.create_table(
            'queues',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('workspace_id', sa.String(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_queues_id'), 'queues', ['id'], unique=False)
        op.create_index(op.f('ix_queues_workspace_id'), 'queues', ['workspace_id'], unique=False)

    # 2. Create 'agent_queues' association table if it doesn't exist
    if 'agent_queues' not in tables:
        op.create_table(
            'agent_queues',
            sa.Column('agent_id', sa.String(), nullable=False),
            sa.Column('queue_id', sa.String(), nullable=False),
            sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
            sa.ForeignKeyConstraint(['queue_id'], ['queues.id']),
            sa.PrimaryKeyConstraint('agent_id', 'queue_id')
        )

    # 3. Add columns to 'conversations' table
    conv_cols = [col['name'] for col in inspector.get_columns('conversations')]
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        if 'queue_id' not in conv_cols:
            batch_op.add_column(sa.Column('queue_id', sa.String(), nullable=True))
            batch_op.create_foreign_key('fk_conversations_queue_id', 'queues', ['queue_id'], ['id'])
            batch_op.create_index('ix_conversations_queue_id', ['queue_id'], unique=False)
        if 'external_id' not in conv_cols:
            batch_op.add_column(sa.Column('external_id', sa.String(), nullable=True))
            batch_op.create_index('ix_conversations_external_id', ['external_id'], unique=False)

    # 4. Add columns to 'messages' table
    msg_cols = [col['name'] for col in inspector.get_columns('messages')]
    with op.batch_alter_table('messages', schema=None) as batch_op:
        if 'is_private' not in msg_cols:
            batch_op.add_column(sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.false()))
        if 'quoted_message_id' not in msg_cols:
            batch_op.add_column(sa.Column('quoted_message_id', sa.String(), nullable=True))
            batch_op.create_foreign_key('fk_messages_quoted_message_id', 'messages', ['quoted_message_id'], ['id'])
            batch_op.create_index('ix_messages_quoted_message_id', ['quoted_message_id'], unique=False)
        if 'quoted_content' not in msg_cols:
            batch_op.add_column(sa.Column('quoted_content', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Remove columns from 'messages'
    if 'messages' in tables:
        msg_cols = [col['name'] for col in inspector.get_columns('messages')]
        with op.batch_alter_table('messages', schema=None) as batch_op:
            if 'quoted_content' in msg_cols:
                batch_op.drop_column('quoted_content')
            if 'quoted_message_id' in msg_cols:
                batch_op.drop_index('ix_messages_quoted_message_id')
                batch_op.drop_constraint('fk_messages_quoted_message_id', type_='foreignkey')
                batch_op.drop_column('quoted_message_id')
            if 'is_private' in msg_cols:
                batch_op.drop_column('is_private')

    # 2. Remove columns from 'conversations'
    if 'conversations' in tables:
        conv_cols = [col['name'] for col in inspector.get_columns('conversations')]
        with op.batch_alter_table('conversations', schema=None) as batch_op:
            if 'external_id' in conv_cols:
                batch_op.drop_index('ix_conversations_external_id')
                batch_op.drop_column('external_id')
            if 'queue_id' in conv_cols:
                batch_op.drop_index('ix_conversations_queue_id')
                batch_op.drop_constraint('fk_conversations_queue_id', type_='foreignkey')
                batch_op.drop_column('queue_id')

    # 3. Drop tables 'agent_queues' and 'queues'
    if 'agent_queues' in tables:
        op.drop_table('agent_queues')
    if 'queues' in tables:
        op.drop_index('ix_queues_workspace_id', table_name='queues')
        op.drop_index('ix_queues_id', table_name='queues')
        op.drop_table('queues')
