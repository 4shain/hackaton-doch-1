"""Move already-approved reports into the automatic HR handoff state.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE attendance_reports
        SET state = 'sent_to_hr',
            sent_to_hr_at = COALESCE(sent_to_hr_at, approved_at, updated_at),
            sent_to_hr_by_id = COALESCE(sent_to_hr_by_id, approved_by_id)
        WHERE state = 'approved'
        """
    )


def downgrade() -> None:
    # The old and newly automatic handoffs are intentionally indistinguishable once migrated.
    pass
