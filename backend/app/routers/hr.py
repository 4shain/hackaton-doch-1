import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_principal
from app.db import get_db
from app.errors import AppError, forbidden
from app.models import AttendanceReport, ReportAuditEvent, ReportState, Unit, User
from app.services import attendance as svc
from app.services.scope import Principal, require_hr_of
from app.timeutil import local_today

router = APIRouter(prefix="/api/hr", tags=["hr"])

STATE_LABELS = {
    ReportState.scheduled: "מתוכנן",
    ReportState.pending_approval: "ממתין לאישור מפקד",
    ReportState.approved: "אושר ע״י מפקד",
    ReportState.sent_to_hr: "הועבר לשלישות",
    ReportState.hr_final: "עודכן ע״י שלישות",
}
SOURCE_LABELS = {"soldier": "חייל", "commander": "מפקד", "hr": "שלישות"}
EXPORT_MAX_DAYS = 366


def require_hr(p: Principal = Depends(get_principal)) -> Principal:
    if not p.is_hr:
        raise forbidden("NOT_HR")
    return p


class HrSetIn(BaseModel):
    soldier_id: int
    report_date: date
    reason_id: int
    notes: str | None = Field(default=None, max_length=500)


def _unit_soldiers(db: Session, p: Principal, q: str | None) -> list[User]:
    stmt = select(User).options(joinedload(User.unit)).where(User.unit_id == p.hr_unit_id, User.is_active)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.personal_number.ilike(like)))
    return list(db.scalars(stmt.order_by(User.full_name)).all())


@router.get("/roster")
def hr_roster(
    report_date: date | None = Query(default=None),
    q: str | None = Query(default=None, max_length=60),
    p: Principal = Depends(require_hr),
    db: Session = Depends(get_db),
) -> dict:
    report_date = report_date or local_today()
    unit = db.get(Unit, p.hr_unit_id)
    return {
        "unit": {"id": unit.id, "name": unit.name},
        "report_date": report_date.isoformat(),
        "rows": svc.roster_rows(db, _unit_soldiers(db, p, q), report_date),
    }


@router.get("/soldiers/{soldier_id}/history")
def hr_history(
    soldier_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    p: Principal = Depends(require_hr),
    db: Session = Depends(get_db),
) -> dict:
    require_hr_of(db, p, soldier_id)
    today = local_today()
    reports = svc.history(db, soldier_id, date_from or today - timedelta(days=90), date_to or today + timedelta(days=60))
    return {"soldier": svc.soldier_out(db.get(User, soldier_id)), "reports": [svc.report_out(r) for r in reports]}


@router.post("/reports")
def hr_set(body: HrSetIn, p: Principal = Depends(require_hr), db: Session = Depends(get_db)) -> dict:
    return svc.report_out(svc.hr_set(db, p, body.soldier_id, body.report_date, body.reason_id, body.notes))


@router.get("/reports/{report_id}/audit")
def report_audit(report_id: int, p: Principal = Depends(require_hr), db: Session = Depends(get_db)) -> list[dict]:
    report = svc.get_report(db, report_id)
    require_hr_of(db, p, report.soldier_id)
    events = db.scalars(
        select(ReportAuditEvent)
        .options(joinedload(ReportAuditEvent.actor))
        .where(ReportAuditEvent.report_id == report_id)
        .order_by(ReportAuditEvent.created_at, ReportAuditEvent.id)
    ).all()
    return [
        {
            "id": e.id,
            "action": e.action,
            "actor_role": e.actor_role,
            "actor": None if e.actor is None else {"id": e.actor.id, "full_name": e.actor.full_name},
            "changes": e.changes,
            "created_at": e.created_at,
            "report_date": e.report_date.isoformat(),
        }
        for e in events
    ]


@router.get("/export.csv")
def export_csv(
    date_from: date,
    date_to: date,
    p: Principal = Depends(require_hr),
    db: Session = Depends(get_db),
) -> Response:
    if date_to < date_from:
        raise AppError("INVALID_DATE_RANGE", 422)
    if (date_to - date_from).days > EXPORT_MAX_DAYS:
        raise AppError("DATE_RANGE_TOO_LONG", 422)
    soldiers = {s.id: s for s in _unit_soldiers(db, p, None)}
    reports = {
        (r.soldier_id, r.report_date): r
        for r in db.scalars(
            select(AttendanceReport)
            .options(
                joinedload(AttendanceReport.soldier_reason),
                joinedload(AttendanceReport.commander_reason),
                joinedload(AttendanceReport.hr_reason),
            )
            .where(
                AttendanceReport.soldier_id.in_(soldiers.keys()),
                AttendanceReport.report_date >= date_from,
                AttendanceReport.report_date <= date_to,
            )
        ).unique()
    }
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "תאריך", "מספר אישי", "שם מלא", "סטטוס סופי", "מקור הסטטוס", "מצב הדיווח",
            "סטטוס חייל", "הערות חייל", "סטטוס מפקד", "הערות מפקד", "סטטוס שלישות", "הערות שלישות",
        ]
    )
    d = date_from
    while d <= date_to:
        for s in sorted(soldiers.values(), key=lambda x: x.full_name):
            r = reports.get((s.id, d))
            if r is None:
                w.writerow([d.strftime("%d/%m/%Y"), s.personal_number, s.full_name, "לא דווח", "", "חסר דיווח", "", "", "", "", "", ""])
                continue
            eff = svc.effective(r)
            w.writerow(
                [
                    d.strftime("%d/%m/%Y"),
                    s.personal_number,
                    s.full_name,
                    eff["reason"]["label"] if eff["reason"] else "",
                    SOURCE_LABELS[eff["source"]],
                    STATE_LABELS[r.state],
                    r.soldier_reason.label if r.soldier_reason else "",
                    r.soldier_notes or "",
                    r.commander_reason.label if r.commander_reason else "",
                    r.commander_notes or "",
                    r.hr_reason.label if r.hr_reason else "",
                    r.hr_notes or "",
                ]
            )
        d += timedelta(days=1)
    # UTF-8 with BOM so Excel detects Hebrew correctly.
    content = "﻿" + buf.getvalue()
    filename = f"doch1_{date_from.isoformat()}_{date_to.isoformat()}.csv"
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
