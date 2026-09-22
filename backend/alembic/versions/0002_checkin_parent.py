"""checkin re-send: parent request link

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("checkin_requests", sa.Column("parent_request_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_checkin_parent", "checkin_requests", "checkin_requests", ["parent_request_id"], ["id"])
    op.create_index("ix_checkin_requests_parent_request_id", "checkin_requests", ["parent_request_id"])


def downgrade() -> None:
    op.drop_index("ix_checkin_requests_parent_request_id", table_name="checkin_requests")
    op.drop_constraint("fk_checkin_parent", "checkin_requests", type_="foreignkey")
    op.drop_column("checkin_requests", "parent_request_id")
