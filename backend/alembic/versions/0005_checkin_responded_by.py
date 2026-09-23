"""ירוק בעיניים: a commander may answer on behalf of a subordinate

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("checkin_responses", sa.Column("responded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("checkin_responses", "responded_by_id")
