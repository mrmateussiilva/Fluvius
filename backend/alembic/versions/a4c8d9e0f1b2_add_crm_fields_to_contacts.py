"""add crm fields to contacts

Revision ID: a4c8d9e0f1b2
Revises: 9b2f3c4d5e6a
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4c8d9e0f1b2"
down_revision: Union[str, Sequence[str], None] = "9b2f3c4d5e6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("contacts")}

    with op.batch_alter_table("contacts", schema=None) as batch_op:
        if "email" not in existing_columns:
            batch_op.add_column(sa.Column("email", sa.String(), nullable=True))
        if "company" not in existing_columns:
            batch_op.add_column(sa.Column("company", sa.String(), nullable=True))
        if "lead_source" not in existing_columns:
            batch_op.add_column(sa.Column("lead_source", sa.String(), nullable=True))
        if "lifecycle_stage" not in existing_columns:
            batch_op.add_column(sa.Column("lifecycle_stage", sa.String(), nullable=True))
        if "estimated_value" not in existing_columns:
            batch_op.add_column(sa.Column("estimated_value", sa.Float(), nullable=True))
        if "crm_notes" not in existing_columns:
            batch_op.add_column(sa.Column("crm_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("contacts")}

    with op.batch_alter_table("contacts", schema=None) as batch_op:
        if "crm_notes" in existing_columns:
            batch_op.drop_column("crm_notes")
        if "estimated_value" in existing_columns:
            batch_op.drop_column("estimated_value")
        if "lifecycle_stage" in existing_columns:
            batch_op.drop_column("lifecycle_stage")
        if "lead_source" in existing_columns:
            batch_op.drop_column("lead_source")
        if "company" in existing_columns:
            batch_op.drop_column("company")
        if "email" in existing_columns:
            batch_op.drop_column("email")
