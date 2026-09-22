"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-09-22 17:55:03.342567
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostGIS is required infrastructure (no spatial columns are used by the current workflows).
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table('attendance_reasons',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('label', sa.String(length=80), nullable=False),
    sa.Column('description', sa.String(length=160), nullable=True),
    sa.Column('is_present', sa.Boolean(), nullable=False),
    sa.Column('requires_notes', sa.Boolean(), nullable=False),
    sa.Column('icon', sa.String(length=40), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('daily_job_runs',
    sa.Column('run_date', sa.Date(), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('activated_count', sa.Integer(), nullable=False),
    sa.Column('reminder_count', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('run_date')
    )
    op.create_table('units',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('commander_id', sa.Integer(), nullable=True),
    sa.CheckConstraint('parent_id IS NULL OR parent_id <> id', name='ck_unit_not_own_parent'),
    sa.ForeignKeyConstraint(['parent_id'], ['units.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('personal_number', sa.String(length=20), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('rank', sa.String(length=30), nullable=True),
    sa.Column('role_title', sa.String(length=80), nullable=True),
    sa.Column('commander_id', sa.Integer(), nullable=True),
    sa.Column('unit_id', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.CheckConstraint('commander_id IS NULL OR commander_id <> id', name='ck_user_not_own_commander'),
    sa.ForeignKeyConstraint(['commander_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_commander_id'), 'users', ['commander_id'], unique=False)
    op.create_index(op.f('ix_users_personal_number'), 'users', ['personal_number'], unique=True)
    op.create_index(op.f('ix_users_unit_id'), 'users', ['unit_id'], unique=False)
    op.create_foreign_key('fk_units_commander', 'units', 'users', ['commander_id'], ['id'])
    op.create_table('attendance_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('soldier_id', sa.Integer(), nullable=False),
    sa.Column('report_date', sa.Date(), nullable=False),
    sa.Column('state', sa.Enum('scheduled', 'pending_approval', 'approved', 'sent_to_hr', 'hr_final', name='report_state'), nullable=False),
    sa.Column('soldier_reason_id', sa.Integer(), nullable=True),
    sa.Column('soldier_notes', sa.Text(), nullable=True),
    sa.Column('soldier_reported_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('commander_reason_id', sa.Integer(), nullable=True),
    sa.Column('commander_notes', sa.Text(), nullable=True),
    sa.Column('commander_reported_by_id', sa.Integer(), nullable=True),
    sa.Column('commander_reported_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('hr_reason_id', sa.Integer(), nullable=True),
    sa.Column('hr_notes', sa.Text(), nullable=True),
    sa.Column('hr_reported_by_id', sa.Integer(), nullable=True),
    sa.Column('hr_reported_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.Integer(), nullable=False),
    sa.Column('submitted_to_commander_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('approved_by_id', sa.Integer(), nullable=True),
    sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('sent_to_hr_by_id', sa.Integer(), nullable=True),
    sa.Column('sent_to_hr_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['commander_reason_id'], ['attendance_reasons.id'], ),
    sa.ForeignKeyConstraint(['commander_reported_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['hr_reason_id'], ['attendance_reasons.id'], ),
    sa.ForeignKeyConstraint(['hr_reported_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['sent_to_hr_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['soldier_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['soldier_reason_id'], ['attendance_reasons.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('soldier_id', 'report_date', name='uq_report_soldier_date')
    )
    op.create_index(op.f('ix_attendance_reports_report_date'), 'attendance_reports', ['report_date'], unique=False)
    op.create_index(op.f('ix_attendance_reports_soldier_id'), 'attendance_reports', ['soldier_id'], unique=False)
    op.create_table('auth_sessions',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('provider', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('token_hash')
    )
    op.create_index(op.f('ix_auth_sessions_user_id'), 'auth_sessions', ['user_id'], unique=False)
    op.create_table('checkin_requests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('commander_id', sa.Integer(), nullable=False),
    sa.Column('message', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['commander_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_checkin_requests_commander_id'), 'checkin_requests', ['commander_id'], unique=False)
    op.create_table('hr_assignments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('unit_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_hr_assignments_unit_id'), 'hr_assignments', ['unit_id'], unique=False)
    op.create_table('notifications',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=40), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('link', sa.String(length=200), nullable=True),
    sa.Column('dedupe_key', sa.String(length=160), nullable=True),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('dedupe_key')
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_table('checkin_responses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('request_id', sa.Integer(), nullable=False),
    sa.Column('recipient_id', sa.Integer(), nullable=False),
    sa.Column('location_text', sa.String(length=300), nullable=True),
    sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['request_id'], ['checkin_requests.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('request_id', 'recipient_id', name='uq_checkin_request_recipient')
    )
    op.create_index(op.f('ix_checkin_responses_recipient_id'), 'checkin_responses', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_checkin_responses_request_id'), 'checkin_responses', ['request_id'], unique=False)
    op.create_table('report_audit_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('report_id', sa.Integer(), nullable=False),
    sa.Column('soldier_id', sa.Integer(), nullable=False),
    sa.Column('report_date', sa.Date(), nullable=False),
    sa.Column('actor_id', sa.Integer(), nullable=True),
    sa.Column('actor_role', sa.String(length=20), nullable=False),
    sa.Column('action', sa.String(length=40), nullable=False),
    sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['attendance_reports.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['soldier_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_report_audit_events_report_id'), 'report_audit_events', ['report_id'], unique=False)


def downgrade() -> None:
    op.drop_constraint('fk_units_commander', 'units', type_='foreignkey')
    op.drop_index(op.f('ix_report_audit_events_report_id'), table_name='report_audit_events')
    op.drop_table('report_audit_events')
    op.drop_index(op.f('ix_checkin_responses_request_id'), table_name='checkin_responses')
    op.drop_index(op.f('ix_checkin_responses_recipient_id'), table_name='checkin_responses')
    op.drop_table('checkin_responses')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_hr_assignments_unit_id'), table_name='hr_assignments')
    op.drop_table('hr_assignments')
    op.drop_index(op.f('ix_checkin_requests_commander_id'), table_name='checkin_requests')
    op.drop_table('checkin_requests')
    op.drop_index(op.f('ix_auth_sessions_user_id'), table_name='auth_sessions')
    op.drop_table('auth_sessions')
    op.drop_index(op.f('ix_attendance_reports_soldier_id'), table_name='attendance_reports')
    op.drop_index(op.f('ix_attendance_reports_report_date'), table_name='attendance_reports')
    op.drop_table('attendance_reports')
    op.drop_index(op.f('ix_users_unit_id'), table_name='users')
    op.drop_index(op.f('ix_users_personal_number'), table_name='users')
    op.drop_index(op.f('ix_users_commander_id'), table_name='users')
    op.drop_table('users')
    op.drop_table('units')
    op.drop_table('daily_job_runs')
    op.drop_table('attendance_reasons')
    sa.Enum(name='report_state').drop(op.get_bind(), checkfirst=True)
