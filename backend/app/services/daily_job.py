"""Daily 08:00 (Asia/Jerusalem) processing.

For the given date:
  1. scheduled reports with report_date <= date move to pending_approval (enter the commander queue);
  2. every active soldier without a report for the date gets one in-app reminder.

Idempotent and safe under concurrent execution:
  * a transaction-level advisory lock serialises runs;
  * activation only touches rows still in `scheduled` (approved reports are never reset);
  * notifications use deterministic dedupe keys with ON CONFLICT DO NOTHING.
This is not a report-freezing cutoff.
"""

import asyncio
import logging
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import AttendanceReport, DailyJobRun, ReportAuditEvent, ReportState, User
from app.services.notify import notify
from app.timeutil import local_now, utcnow

log = logging.getLogger("doch1.daily_job")
LOCK_KEY = 80_0001


def run_daily_job(db: Session, run_date: date) -> dict:
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": LOCK_KEY})
    now = utcnow()

    due = db.scalars(
        select(AttendanceReport)
        .where(AttendanceReport.state == ReportState.scheduled, AttendanceReport.report_date <= run_date)
        .with_for_update(skip_locked=True)
    ).all()
    for r in due:
        r.state = ReportState.pending_approval
        r.submitted_to_commander_at = now
        db.add(
            ReportAuditEvent(
                report_id=r.id,
                soldier_id=r.soldier_id,
                report_date=r.report_date,
                actor_id=None,
                actor_role="system",
                action="activated_by_daily_job",
                changes={"state": {"from": "scheduled", "to": "pending_approval"}},
            )
        )
        soldier = db.get(User, r.soldier_id)
        if soldier and soldier.commander_id:
            notify(
                db,
                soldier.commander_id,
                "report_pending",
                f"דיווח מתוכנן ממתין לאישורך: {soldier.full_name}",
                run_date.strftime("%d/%m/%Y"),
                link=f"/soldiers?date={r.report_date.isoformat()}",
                dedupe_key=f"activated:{r.id}",
            )

    missing = db.scalars(
        select(User.id).where(
            User.is_active,
            ~select(AttendanceReport.id)
            .where(AttendanceReport.soldier_id == User.id, AttendanceReport.report_date == run_date)
            .exists(),
        )
    ).all()
    reminders = 0
    for uid in missing:
        if notify(
            db,
            uid,
            "report_reminder",
            "תזכורת: טרם דיווחת נוכחות להיום",
            run_date.strftime("%d/%m/%Y"),
            link=f"/?date={run_date.isoformat()}",
            dedupe_key=f"reminder:{run_date.isoformat()}:{uid}",
        ):
            reminders += 1

    stmt = insert(DailyJobRun).values(run_date=run_date, finished_at=now, activated_count=len(due), reminder_count=reminders)
    stmt = stmt.on_conflict_do_update(
        index_elements=["run_date"],
        set_={
            "finished_at": now,
            "activated_count": DailyJobRun.activated_count + len(due),
            "reminder_count": DailyJobRun.reminder_count + reminders,
        },
    )
    db.execute(stmt)
    db.commit()
    result = {"run_date": run_date.isoformat(), "activated": len(due), "reminders_sent": reminders}
    log.info("daily job: %s", result)
    return result


def _due_now(db: Session) -> date | None:
    now = local_now()
    if now.hour < get_settings().daily_job_hour:
        return None
    today = now.date()
    done = db.scalar(select(DailyJobRun.run_date).where(DailyJobRun.run_date == today))
    return None if done else today


async def scheduler_loop(interval_seconds: int = 60) -> None:
    """Lightweight in-process scheduler: once per day, at/after 08:00 local time, run the job."""
    while True:
        try:
            with SessionLocal() as db:
                run_date = _due_now(db)
                if run_date:
                    run_daily_job(db, run_date)
        except Exception:  # keep the loop alive
            log.exception("daily job failed")
        await asyncio.sleep(interval_seconds)
