from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_principal
from app.db import get_db
from app.errors import forbidden
from app.models import User
from app.services import attendance as svc
from app.services.scope import Principal, require_commander_of
from app.timeutil import local_today

router = APIRouter(prefix="/api/commander", tags=["commander"])


def require_commander(p: Principal = Depends(get_principal)) -> Principal:
    if not p.is_commander:
        raise forbidden("NOT_A_COMMANDER")
    return p


class ApproveIn(BaseModel):
    reason_id: int | None = None
    notes: str | None = Field(default=None, max_length=500)


class OnBehalfIn(BaseModel):
    soldier_id: int
    report_date: date
    reason_id: int
    notes: str | None = Field(default=None, max_length=500)


class SendToHrIn(BaseModel):
    report_ids: list[int] = Field(min_length=1, max_length=500)


@router.get("/roster")
def roster(
    report_date: date | None = Query(default=None),
    p: Principal = Depends(require_commander),
    db: Session = Depends(get_db),
) -> dict:
    report_date = report_date or local_today()
    soldiers = db.scalars(
        select(User)
        .options(joinedload(User.unit))
        .where(User.id.in_(p.direct_report_ids))
        .order_by(User.full_name)
    ).all()
    return {"report_date": report_date.isoformat(), "rows": svc.roster_rows(db, list(soldiers), report_date)}


@router.get("/soldiers/{soldier_id}/history")
def soldier_history(
    soldier_id: int,
    days: int = Query(default=30, ge=1, le=365),
    date_from: date | None = None,
    date_to: date | None = None,
    p: Principal = Depends(require_commander),
    db: Session = Depends(get_db),
) -> dict:
    require_commander_of(p, soldier_id)
    today = local_today()
    soldier = db.get(User, soldier_id)
    reports = svc.history(db, soldier_id, date_from or today - timedelta(days=days), date_to or today + timedelta(days=60))
    return {"soldier": svc.soldier_out(soldier), "reports": [svc.report_out(r) for r in reports]}


@router.post("/reports/{report_id}/approve")
def approve(report_id: int, body: ApproveIn, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return svc.report_out(svc.commander_approve(db, p, report_id, body.reason_id, body.notes))


@router.post("/reports/on-behalf")
def on_behalf(body: OnBehalfIn, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return svc.report_out(
        svc.commander_submit_on_behalf(db, p, body.soldier_id, body.report_date, body.reason_id, body.notes)
    )


@router.post("/reports/send-to-hr")
def send_to_hr(body: SendToHrIn, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    sent = svc.commander_send_to_hr(db, p, body.report_ids)
    return {"sent": len(sent)}
