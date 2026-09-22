"""Attendance workflow rules.

Layers: soldier / commander / HR values are stored side by side and never overwrite each other.
Effective status = HR value if present, else commander value, else soldier value.

Rules (MVP):
  * Soldiers report for today or future dates (future -> `scheduled` until 08:00 on that date).
  * A material soldier edit (reason or notes changed) of an approved / sent report invalidates the
    commander approval: commander layer is cleared (kept in the audit log) and the report returns to review.
  * Commanders act on direct reports only. They may write the commander layer for *today*,
    approve today's/future reports as-is, and view history. Historical edits are HR-only.
  * Once HR writes its layer the report is `hr_final`: soldier and commander edits are refused
    (REPORT_LOCKED_BY_HR); only HR may change it further.
  * A missing report is never an absence; it is reported as "missing".
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.errors import AppError, not_found
from app.models import AttendanceReason, AttendanceReport, ReportAuditEvent, ReportState, User
from app.services.notify import notify
from app.services.scope import Principal, require_commander_of, require_hr_of
from app.timeutil import local_today, utcnow

NOTES_MAX = 500

_report_options = (
    joinedload(AttendanceReport.soldier_reason),
    joinedload(AttendanceReport.commander_reason),
    joinedload(AttendanceReport.hr_reason),
    joinedload(AttendanceReport.commander_reported_by),
    joinedload(AttendanceReport.hr_reported_by),
    joinedload(AttendanceReport.approved_by),
    joinedload(AttendanceReport.created_by),
)


# ---------------------------------------------------------------- helpers

def clean_notes(notes: str | None) -> str | None:
    if notes is None:
        return None
    notes = notes.strip()
    if len(notes) > NOTES_MAX:
        raise AppError("NOTES_TOO_LONG", 422)
    return notes or None


def get_reason(db: Session, reason_id: int) -> AttendanceReason:
    reason = db.get(AttendanceReason, reason_id)
    if reason is None or not reason.active:
        raise AppError("INVALID_REASON", 422)
    return reason


def validate_reason_and_notes(db: Session, reason_id: int, notes: str | None) -> tuple[AttendanceReason, str | None]:
    reason = get_reason(db, reason_id)
    notes = clean_notes(notes)
    if reason.requires_notes and not notes:
        raise AppError("NOTES_REQUIRED", 422)
    return reason, notes


def find_report(db: Session, soldier_id: int, report_date: date) -> AttendanceReport | None:
    return db.scalar(
        select(AttendanceReport)
        .options(*_report_options)
        .where(AttendanceReport.soldier_id == soldier_id, AttendanceReport.report_date == report_date)
    )


def get_report(db: Session, report_id: int) -> AttendanceReport:
    report = db.scalar(
        select(AttendanceReport)
        .options(*_report_options)
        .where(AttendanceReport.id == report_id)
        .execution_options(populate_existing=True)  # refresh relationships after FK changes
    )
    if report is None:
        raise not_found("REPORT_NOT_FOUND")
    return report


def _snapshot(r: AttendanceReport) -> dict:
    return {
        "state": r.state.value if r.state else None,
        "soldier_reason_id": r.soldier_reason_id,
        "soldier_notes": r.soldier_notes,
        "commander_reason_id": r.commander_reason_id,
        "commander_notes": r.commander_notes,
        "hr_reason_id": r.hr_reason_id,
        "hr_notes": r.hr_notes,
    }


def _audit(db: Session, r: AttendanceReport, actor_id: int | None, role: str, action: str, before: dict) -> None:
    after = _snapshot(r)
    changes = {k: {"from": before.get(k), "to": v} for k, v in after.items() if before.get(k) != v}
    db.add(
        ReportAuditEvent(
            report_id=r.id,
            soldier_id=r.soldier_id,
            report_date=r.report_date,
            actor_id=actor_id,
            actor_role=role,
            action=action,
            changes=changes,
        )
    )


def _new_report(db: Session, soldier_id: int, report_date: date, created_by: int, state: ReportState) -> AttendanceReport:
    r = AttendanceReport(soldier_id=soldier_id, report_date=report_date, created_by_id=created_by, state=state)
    db.add(r)
    db.flush()
    return r


def _clear_approval(r: AttendanceReport) -> None:
    r.commander_reason_id = None
    r.commander_notes = None
    r.commander_reported_by_id = None
    r.commander_reported_at = None
    r.approved_by_id = None
    r.approved_at = None
    r.sent_to_hr_at = None
    r.sent_to_hr_by_id = None


def _lock_check(r: AttendanceReport) -> None:
    if r.state == ReportState.hr_final:
        raise AppError("REPORT_LOCKED_BY_HR", 409)


def _state_for_new_submission(report_date: date) -> ReportState:
    return ReportState.scheduled if report_date > local_today() else ReportState.pending_approval


# ---------------------------------------------------------------- soldier

def soldier_submit(db: Session, p: Principal, report_date: date, reason_id: int, notes: str | None) -> AttendanceReport:
    today = local_today()
    if report_date < today:
        raise AppError("PAST_DATE_NOT_ALLOWED", 422)
    if report_date > today + timedelta(days=get_settings().max_future_days):
        raise AppError("DATE_TOO_FAR", 422)
    reason, notes = validate_reason_and_notes(db, reason_id, notes)

    r = find_report(db, p.id, report_date)
    now = utcnow()
    if r is None:
        r = _new_report(db, p.id, report_date, p.id, _state_for_new_submission(report_date))
        before = {}
        action = "soldier_submitted"
    else:
        _lock_check(r)
        if r.soldier_reason_id == reason.id and r.soldier_notes == notes:
            return r  # nothing changed
        before = _snapshot(r)
        action = "soldier_updated"
        # Material edit: any previous approval (or commander correction) is invalidated.
        if r.state in (ReportState.approved, ReportState.sent_to_hr) or r.commander_reason_id is not None:
            _clear_approval(r)
            action = "soldier_updated_approval_invalidated"
        r.state = _state_for_new_submission(report_date)

    r.soldier_reason_id = reason.id
    r.soldier_notes = notes
    r.soldier_reported_at = now
    if r.state == ReportState.pending_approval:
        r.submitted_to_commander_at = now
    db.flush()
    _audit(db, r, p.id, "soldier", action, before)

    if r.state == ReportState.pending_approval and p.user.commander_id:
        notify(
            db,
            p.user.commander_id,
            "report_pending",
            f"דיווח חדש ממתין לאישורך: {p.user.full_name}",
            f"{reason.label} · {report_date.strftime('%d/%m/%Y')}",
            link=f"/soldiers?date={report_date.isoformat()}",
            dedupe_key=f"report_pending:{r.id}:{int(now.timestamp())}",
        )
    db.commit()
    return get_report(db, r.id)


MAX_RANGE_DAYS = 31


def soldier_submit_range(
    db: Session, p: Principal, date_from: date, date_to: date, reason_id: int, notes: str | None
) -> dict:
    """Report the same status for every day in [date_from, date_to].

    Everything is validated up front, so no day is written if the input is invalid.
    Days already finalised by HR are skipped (never overwritten) and returned separately.
    """
    today = local_today()
    if date_to < date_from:
        raise AppError("INVALID_DATE_RANGE", 422)
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise AppError("DATE_RANGE_TOO_LONG_REPORT", 422)
    if date_from < today:
        raise AppError("PAST_DATE_NOT_ALLOWED", 422)
    if date_to > today + timedelta(days=get_settings().max_future_days):
        raise AppError("DATE_TOO_FAR", 422)
    validate_reason_and_notes(db, reason_id, notes)

    submitted, skipped = [], []
    d = date_from
    while d <= date_to:
        existing = find_report(db, p.id, d)
        if existing is not None and existing.state == ReportState.hr_final:
            skipped.append(d.isoformat())
        else:
            soldier_submit(db, p, d, reason_id, notes)
            submitted.append(d.isoformat())
        d += timedelta(days=1)
    return {"submitted": submitted, "skipped_locked": skipped}


# ---------------------------------------------------------------- commander

def commander_approve(
    db: Session, p: Principal, report_id: int, reason_id: int | None = None, notes: str | None = None
) -> AttendanceReport:
    r = get_report(db, report_id)
    require_commander_of(p, r.soldier_id)
    _lock_check(r)
    if r.state == ReportState.sent_to_hr and reason_id is None:
        raise AppError("ALREADY_SENT_TO_HR", 409)

    before = _snapshot(r)
    now = utcnow()
    action = "commander_approved"
    if reason_id is not None:
        if r.report_date != local_today():
            raise AppError("COMMANDER_EDIT_TODAY_ONLY", 422)
        reason, notes = validate_reason_and_notes(db, reason_id, notes)
        r.commander_reason_id = reason.id
        r.commander_notes = notes
        r.commander_reported_by_id = p.id
        r.commander_reported_at = now
        action = "commander_corrected_and_approved"
        r.sent_to_hr_at = None  # a corrected report must be handed off again
        r.sent_to_hr_by_id = None

    r.approved_by_id = p.id
    r.approved_at = now
    r.state = ReportState.approved
    db.flush()
    _audit(db, r, p.id, "commander", action, before)
    notify(
        db,
        r.soldier_id,
        "report_approved",
        "הדיווח שלך אושר" if reason_id is None else "המפקד עדכן ואישר את הדיווח שלך",
        r.report_date.strftime("%d/%m/%Y"),
        link=f"/?date={r.report_date.isoformat()}",
    )
    db.commit()
    return get_report(db, r.id)


def commander_submit_on_behalf(
    db: Session, p: Principal, soldier_id: int, report_date: date, reason_id: int, notes: str | None
) -> AttendanceReport:
    """Commander reports for a soldier. Stored in the commander layer and attributed to the commander."""
    require_commander_of(p, soldier_id)
    if report_date != local_today():
        raise AppError("COMMANDER_EDIT_TODAY_ONLY", 422)
    reason, notes = validate_reason_and_notes(db, reason_id, notes)
    r = find_report(db, soldier_id, report_date)
    now = utcnow()
    if r is None:
        r = _new_report(db, soldier_id, report_date, p.id, ReportState.approved)
        before: dict = {}
    else:
        _lock_check(r)
        before = _snapshot(r)
    r.commander_reason_id = reason.id
    r.commander_notes = notes
    r.commander_reported_by_id = p.id
    r.commander_reported_at = now
    r.approved_by_id = p.id
    r.approved_at = now
    r.sent_to_hr_at = None
    r.sent_to_hr_by_id = None
    r.state = ReportState.approved
    db.flush()
    _audit(db, r, p.id, "commander", "commander_reported_on_behalf", before)
    notify(db, soldier_id, "report_on_behalf", "המפקד דיווח עבורך", f"{reason.label} · {report_date.strftime('%d/%m/%Y')}")
    db.commit()
    return get_report(db, r.id)


def commander_send_to_hr(db: Session, p: Principal, report_ids: list[int]) -> list[AttendanceReport]:
    """Hand approved reports off to the unit HR view ("שליחה לשלישות"). Local workflow only."""
    if not report_ids:
        raise AppError("NOTHING_TO_SEND", 422)
    now = utcnow()
    sent = []
    for rid in report_ids:
        r = get_report(db, rid)
        require_commander_of(p, r.soldier_id)
        if r.state != ReportState.approved:
            raise AppError("REPORT_NOT_APPROVED", 409, details={"report_id": rid})
        before = _snapshot(r)
        r.state = ReportState.sent_to_hr
        r.sent_to_hr_at = now
        r.sent_to_hr_by_id = p.id
        db.flush()
        _audit(db, r, p.id, "commander", "sent_to_hr", before)
        sent.append(r)
    db.commit()
    return sent


# ---------------------------------------------------------------- HR

def hr_set(db: Session, p: Principal, soldier_id: int, report_date: date, reason_id: int, notes: str | None) -> AttendanceReport:
    """HR writes its own layer (current or historical). Creates the report if missing (on behalf)."""
    require_hr_of(db, p, soldier_id)
    if report_date > local_today() + timedelta(days=get_settings().max_future_days):
        raise AppError("DATE_TOO_FAR", 422)
    reason, notes = validate_reason_and_notes(db, reason_id, notes)
    r = find_report(db, soldier_id, report_date)
    if r is None:
        r = _new_report(db, soldier_id, report_date, p.id, ReportState.hr_final)
        before: dict = {}
        action = "hr_reported_on_behalf"
    else:
        before = _snapshot(r)
        action = "hr_updated" if r.hr_reason_id is not None else "hr_set"
    r.hr_reason_id = reason.id
    r.hr_notes = notes
    r.hr_reported_by_id = p.id
    r.hr_reported_at = utcnow()
    r.state = ReportState.hr_final
    db.flush()
    _audit(db, r, p.id, "hr", action, before)
    db.commit()
    return get_report(db, r.id)


# ---------------------------------------------------------------- serialization

def reason_out(reason: AttendanceReason | None) -> dict | None:
    if reason is None:
        return None
    return {
        "id": reason.id,
        "code": reason.code,
        "label": reason.label,
        "is_present": reason.is_present,
        "requires_notes": reason.requires_notes,
        "icon": reason.icon,
    }


def _person(u: User | None) -> dict | None:
    return None if u is None else {"id": u.id, "full_name": u.full_name, "personal_number": u.personal_number}


def effective(r: AttendanceReport) -> dict:
    if r.hr_reason is not None:
        return {"source": "hr", "reason": reason_out(r.hr_reason), "notes": r.hr_notes}
    if r.commander_reason is not None:
        return {"source": "commander", "reason": reason_out(r.commander_reason), "notes": r.commander_notes}
    return {"source": "soldier", "reason": reason_out(r.soldier_reason), "notes": r.soldier_notes}


def report_out(r: AttendanceReport) -> dict:
    return {
        "id": r.id,
        "soldier_id": r.soldier_id,
        "report_date": r.report_date.isoformat(),
        "state": r.state.value,
        "soldier_layer": None
        if r.soldier_reason is None
        else {"reason": reason_out(r.soldier_reason), "notes": r.soldier_notes, "at": r.soldier_reported_at, "by": None},
        "commander_layer": None
        if r.commander_reason is None
        else {
            "reason": reason_out(r.commander_reason),
            "notes": r.commander_notes,
            "at": r.commander_reported_at,
            "by": _person(r.commander_reported_by),
        },
        "hr_layer": None
        if r.hr_reason is None
        else {"reason": reason_out(r.hr_reason), "notes": r.hr_notes, "at": r.hr_reported_at, "by": _person(r.hr_reported_by)},
        "effective": effective(r),
        "created_by": _person(r.created_by),
        "approved_by": _person(r.approved_by),
        "approved_at": r.approved_at,
        "sent_to_hr_at": r.sent_to_hr_at,
        "updated_at": r.updated_at,
    }


def soldier_out(u: User) -> dict:
    return {
        "id": u.id,
        "personal_number": u.personal_number,
        "full_name": u.full_name,
        "rank": u.rank,
        "role_title": u.role_title,
        "unit_id": u.unit_id,
        "unit_name": u.unit.name if u.unit else None,
        "commander_id": u.commander_id,
    }


def roster_rows(db: Session, soldiers: list[User], report_date: date) -> list[dict]:
    ids = [s.id for s in soldiers]
    reports = {
        r.soldier_id: r
        for r in db.scalars(
            select(AttendanceReport)
            .options(*_report_options)
            .where(AttendanceReport.soldier_id.in_(ids), AttendanceReport.report_date == report_date)
        ).unique()
    } if ids else {}
    return [
        {"soldier": soldier_out(s), "report": report_out(reports[s.id]) if s.id in reports else None}
        for s in soldiers
    ]


def history(db: Session, soldier_id: int, date_from: date, date_to: date) -> list[AttendanceReport]:
    return list(
        db.scalars(
            select(AttendanceReport)
            .options(*_report_options)
            .where(
                AttendanceReport.soldier_id == soldier_id,
                AttendanceReport.report_date >= date_from,
                AttendanceReport.report_date <= date_to,
            )
            .order_by(AttendanceReport.report_date.desc())
        ).unique()
    )
