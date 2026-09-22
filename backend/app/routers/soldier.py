from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_principal
from app.config import get_settings
from app.db import get_db
from app.models import AttendanceReason
from app.services import attendance as svc
from app.services.scope import Principal
from app.timeutil import local_now, local_today

router = APIRouter(prefix="/api", tags=["soldier"])


class SubmitIn(BaseModel):
    report_date: date
    reason_id: int
    notes: str | None = Field(default=None, max_length=500)


class SubmitRangeIn(BaseModel):
    date_from: date
    date_to: date
    reason_id: int
    notes: str | None = Field(default=None, max_length=500)


class SubmitDatesIn(BaseModel):
    report_dates: list[date] = Field(min_length=1, max_length=31)
    reason_id: int
    notes: str | None = Field(default=None, max_length=500)


@router.get("/meta")
def meta(db: Session = Depends(get_db)) -> dict:
    reasons = db.scalars(select(AttendanceReason).where(AttendanceReason.active).order_by(AttendanceReason.sort_order)).all()
    return {
        "today": local_today().isoformat(),
        "now": local_now().isoformat(),
        "timezone": "Asia/Jerusalem",
        "max_future_days": get_settings().max_future_days,
        "reasons": [
            {
                "id": r.id,
                "code": r.code,
                "label": r.label,
                "description": r.description,
                "is_present": r.is_present,
                "requires_notes": r.requires_notes,
                "icon": r.icon,
            }
            for r in reasons
        ],
    }


@router.get("/my/reports")
def my_reports(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    p: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[dict]:
    today = local_today()
    date_from = date_from or today - timedelta(days=30)
    date_to = date_to or today + timedelta(days=30)
    return [svc.report_out(r) for r in svc.history(db, p.id, date_from, date_to)]


@router.post("/my/reports")
def submit_my_report(body: SubmitIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    return svc.report_out(svc.soldier_submit(db, p, body.report_date, body.reason_id, body.notes))


@router.post("/my/reports/range")
def submit_my_report_range(body: SubmitRangeIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    """Same status for several consecutive days (e.g. a vacation)."""
    return svc.soldier_submit_range(db, p, body.date_from, body.date_to, body.reason_id, body.notes)


@router.post("/my/reports/dates")
def submit_my_report_dates(body: SubmitDatesIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    """Apply one status to selected, not necessarily consecutive, days."""
    return svc.soldier_submit_dates(db, p, body.report_dates, body.reason_id, body.notes)
