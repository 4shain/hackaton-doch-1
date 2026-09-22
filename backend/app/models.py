"""SQLAlchemy models.

Two hierarchies are intentionally kept separate:
  * the *unit* hierarchy (units.parent_id), used for HR scope;
  * the *reporting* hierarchy (users.commander_id), used for commander scope.
"""

import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ReportState(str, enum.Enum):
    # Future-dated report, waiting for the 08:00 job on its date.
    scheduled = "scheduled"
    # In the commander's approval queue.
    pending_approval = "pending_approval"
    # Approved by the commander (possibly with commander corrections).
    approved = "approved"
    # Approved and handed off to the unit's HR view ("שליחה לשלישות").
    sent_to_hr = "sent_to_hr"
    # HR has written its own layer. Only HR may change the report from here on.
    hr_final = "hr_final"


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"))
    # Exactly one commander per unit (nullable only to allow bootstrapping inserts).
    commander_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", use_alter=True, name="fk_units_commander"))

    parent: Mapped["Unit | None"] = relationship(remote_side=[id], foreign_keys=[parent_id])
    commander: Mapped["User | None"] = relationship(foreign_keys=[commander_id])

    __table_args__ = (CheckConstraint("parent_id IS NULL OR parent_id <> id", name="ck_unit_not_own_parent"),)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    rank: Mapped[str | None] = mapped_column(String(30))
    role_title: Mapped[str | None] = mapped_column(String(80))
    commander_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    unit: Mapped[Unit] = relationship(foreign_keys=[unit_id])
    commander: Mapped["User | None"] = relationship(remote_side=[id], foreign_keys=[commander_id])

    __table_args__ = (CheckConstraint("commander_id IS NULL OR commander_id <> id", name="ck_user_not_own_commander"),)


class HrAssignment(Base):
    """Explicit HR capability. MVP: each HR user manages exactly one unit; a unit may have many HRs."""

    __tablename__ = "hr_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)

    user: Mapped[User] = relationship()
    unit: Mapped[Unit] = relationship()


class AttendanceReason(Base):
    """Configurable attendance statuses. Seeded values are demo values, not an official list."""

    __tablename__ = "attendance_reasons"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    label: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(String(160))
    is_present: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_notes: Mapped[bool] = mapped_column(Boolean, default=False)
    icon: Mapped[str | None] = mapped_column(String(40))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class AttendanceReport(Base):
    __tablename__ = "attendance_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    soldier_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    report_date: Mapped[date] = mapped_column(Date, index=True)
    state: Mapped[ReportState] = mapped_column(Enum(ReportState, name="report_state"))

    # Soldier layer (only ever written by the soldier themself).
    soldier_reason_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_reasons.id"))
    soldier_notes: Mapped[str | None] = mapped_column(Text)
    soldier_reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Commander layer.
    commander_reason_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_reasons.id"))
    commander_notes: Mapped[str | None] = mapped_column(Text)
    commander_reported_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    commander_reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # HR layer.
    hr_reason_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_reasons.id"))
    hr_notes: Mapped[str | None] = mapped_column(Text)
    hr_reported_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    hr_reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Workflow metadata.
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    submitted_to_commander_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_to_hr_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    sent_to_hr_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    soldier: Mapped[User] = relationship(foreign_keys=[soldier_id])
    soldier_reason: Mapped[AttendanceReason | None] = relationship(foreign_keys=[soldier_reason_id])
    commander_reason: Mapped[AttendanceReason | None] = relationship(foreign_keys=[commander_reason_id])
    hr_reason: Mapped[AttendanceReason | None] = relationship(foreign_keys=[hr_reason_id])
    commander_reported_by: Mapped[User | None] = relationship(foreign_keys=[commander_reported_by_id])
    hr_reported_by: Mapped[User | None] = relationship(foreign_keys=[hr_reported_by_id])
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])

    __table_args__ = (UniqueConstraint("soldier_id", "report_date", name="uq_report_soldier_date"),)


class ReportAuditEvent(Base):
    __tablename__ = "report_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("attendance_reports.id", ondelete="CASCADE"), index=True)
    soldier_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    report_date: Mapped[date] = mapped_column(Date)
    # Null actor = system (e.g. the 08:00 job).
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    actor_role: Mapped[str] = mapped_column(String(20))  # soldier | commander | hr | system
    action: Mapped[str] = mapped_column(String(40))
    changes: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    actor: Mapped[User | None] = relationship(foreign_keys=[actor_id])


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(200))
    # Unique key used to make notification creation idempotent.
    dedupe_key: Mapped[str | None] = mapped_column(String(160), unique=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CheckinRequest(Base):
    """ירוק בעיניים request. Recipients are snapshotted at creation time."""

    __tablename__ = "checkin_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    commander_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Set when a mid-level commander re-sends a request they received down to their own subordinates.
    parent_request_id: Mapped[int | None] = mapped_column(ForeignKey("checkin_requests.id"), index=True)
    message: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    commander: Mapped[User] = relationship()
    responses: Mapped[list["CheckinResponse"]] = relationship(back_populates="request", order_by="CheckinResponse.id")


class CheckinResponse(Base):
    __tablename__ = "checkin_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("checkin_requests.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    location_text: Mapped[str | None] = mapped_column(String(300))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    request: Mapped[CheckinRequest] = relationship(back_populates="responses")
    recipient: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("request_id", "recipient_id", name="uq_checkin_request_recipient"),)


class DailyJobRun(Base):
    __tablename__ = "daily_job_runs"

    run_date: Mapped[date] = mapped_column(Date, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_count: Mapped[int] = mapped_column(Integer, default=0)
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(20))  # "dev" | "sso"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
