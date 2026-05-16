"""create quick replies table

Revision ID: d6f8e7a4b2c1
Revises: c5ead3307eb8
Create Date: 2026-05-16 19:22:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd6f8e7a4b2c1'
down_revision = 'c5ead3307eb8'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'quick_replies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('shortcut', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], )
    )
    op.create_index(op.f('ix_quick_replies_id'), 'quick_replies', ['id'], unique=False)
    op.create_index(op.f('ix_quick_replies_workspace_id'), 'quick_replies', ['workspace_id'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_quick_replies_workspace_id'), table_name='quick_replies')
    op.drop_index(op.f('ix_quick_replies_id'), table_name='quick_replies')
    op.drop_table('quick_replies')
