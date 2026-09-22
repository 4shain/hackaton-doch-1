"""nightly Jev anomaly scan

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "anomaly_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_date", sa.Date(), nullable=False),
        sa.Column("window_from", sa.Date(), nullable=False),
        sa.Column("window_to", sa.Date(), nullable=False),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.id"), nullable=True),
        sa.Column("trigger", sa.String(length=20), nullable=False),
        sa.Column("model", sa.String(length=40), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_count", sa.Integer(), nullable=False),
        sa.Column("flagged_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_anomaly_runs_run_date", "anomaly_runs", ["run_date"])
    # At most one nightly (all-soldiers) run per date.
    op.create_index(
        "uq_anomaly_runs_nightly", "anomaly_runs", ["run_date"], unique=True, postgresql_where=sa.text("unit_id IS NULL")
    )
    op.create_table(
        "soldier_anomalies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("anomaly_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("soldier_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("severity", sa.Float(), nullable=False),
        sa.Column("signals", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("facts", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "soldier_id", name="uq_anomaly_run_soldier"),
    )
    op.create_index("ix_soldier_anomalies_run_id", "soldier_anomalies", ["run_id"])
    op.create_index("ix_soldier_anomalies_soldier_id", "soldier_anomalies", ["soldier_id"])


def downgrade() -> None:
    op.drop_table("soldier_anomalies")
    op.drop_index("uq_anomaly_runs_nightly", table_name="anomaly_runs")
    op.drop_index("ix_anomaly_runs_run_date", table_name="anomaly_runs")
    op.drop_table("anomaly_runs")
