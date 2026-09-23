"""Nightly anomaly scan with TypeSafe's Jev model.

Each night (default 02:00 Asia/Jerusalem) every active soldier's last N days (default 20, ending
yesterday) are sent to Jev as one "state": a day-by-day timeline of all three report layers plus free-text
notes, and a few facts computed here (Jev is documented as weak at counting and dates, so we count for it).
Jev answers three yes/no signal questions + a severity score in a single call per soldier. A soldier is flagged
when the strongest signal reaches the threshold (Jev's overall "is this weird?" probability proved uncalibrated,
the specific signals separate far better). Flagged soldiers are stored in `soldier_anomalies` and shown on the HR page.

Cost: input tokens only ($0.042 / 1M, output is free). One request per soldier; see README for the estimate.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload
from typesafe_sdk import AsyncTypeSafeClient, Noul, Score

from app.config import get_settings
from app.db import SessionLocal
from app.models import AnomalyRun, AttendanceReport, SoldierAnomaly, User
from app.services.scope import unit_subtree_ids
from app.timeutil import utcnow

log = logging.getLogger("doch1.anomaly")
LOCK_KEY = 80_0002
CHUNK = 500
PRICE_PER_M_INPUT_TOKENS = 0.042

WEEKDAYS = ["ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת", "א׳"]  # date.weekday(): Monday = 0
WEEKEND = {4, 5}  # Friday, Saturday
ABSENCE_SICK = {"sick", "medical"}

SIGNALS = {
    "notes_mismatch": "A free-text note contradicts the status it was reported with (e.g. status 'at base' "
    "but the note says the soldier was at home, abroad, sick or somewhere else).",
    "layer_conflict": "For the same day, the soldier's report and the commander's report disagree in a way "
    "that suggests the soldier reported falsely. A documented HR correction (e.g. per a medical certificate) is normal.",
    "absence_pattern": "The absences form a suspicious pattern: sick days repeatedly right before or after "
    "weekends or vacation, an unusually high number of absent days, or many unreported days.",
}
QUESTIONS = {
    "severity": Score(
        instructions="How much this soldier's reports need HR attention",
        criteria=[
            "Normal, nothing to check",
            "Minor oddity, worth a glance",
            "Needs HR follow-up",
            "Serious, likely false reporting",
        ],
    ),
    **{k: Noul(instructions=v) for k, v in SIGNALS.items()},
}


@dataclass
class Case:
    soldier_id: int
    state: dict
    facts: list[str]


# ---------------------------------------------------------------- state building (pure)

def build_case(soldier: User, reports: list[AttendanceReport], window_from: date, window_to: date) -> Case:
    by_day = {r.report_date: r for r in reports}
    lines: list[str] = []
    missing = absent = sick_near_weekend = disagreements = by_commander = 0
    d = window_from
    while d <= window_to:
        day = f"יום {WEEKDAYS[d.weekday()]} {d.strftime('%d/%m')}"
        r = by_day.get(d)
        if r is None:
            missing += 1
            lines.append(f"{day}: לא דווח")
        else:
            parts = []
            if r.soldier_reason:
                parts.append(f"חייל: {r.soldier_reason.label}" + (f" (\"{r.soldier_notes}\")" if r.soldier_notes else ""))
            if r.commander_reason:
                parts.append(f"מפקד: {r.commander_reason.label}" + (f" (\"{r.commander_notes}\")" if r.commander_notes else ""))
            if r.hr_reason:
                parts.append(f"שלישות: {r.hr_reason.label}" + (f" (\"{r.hr_notes}\")" if r.hr_notes else ""))
            lines.append(f"{day}: " + " | ".join(parts))

            eff = r.hr_reason or r.commander_reason or r.soldier_reason
            if eff is not None and not eff.is_present:
                absent += 1
            if eff is not None and eff.code in ABSENCE_SICK and (
                d.weekday() in WEEKEND or (d + timedelta(days=1)).weekday() in WEEKEND or (d - timedelta(days=1)).weekday() in WEEKEND
            ):
                sick_near_weekend += 1
            layers = {x.id for x in (r.soldier_reason, r.commander_reason, r.hr_reason) if x is not None}
            if len(layers) > 1:
                disagreements += 1
            if r.soldier_reason is None and r.commander_reason is not None:
                by_commander += 1
        d += timedelta(days=1)

    days = (window_to - window_from).days + 1
    facts = [f"{days - missing} ימים דווחו מתוך {days}"]
    if missing:
        facts.append(f"{missing} ימים ללא דיווח")
    if absent:
        facts.append(f"{absent} ימי היעדרות")
    if sick_near_weekend:
        facts.append(f"{sick_near_weekend} ימי מחלה/רפואי צמודים לסוף שבוע")
    if disagreements:
        facts.append(f"{disagreements} ימים עם סתירה בין חייל/מפקד/שלישות")
    if by_commander:
        facts.append(f"{by_commander} ימים דווחו ע״י המפקד בלבד")

    state = {
        # No name or ID number: nothing identifying leaves the system.
        "soldier": soldier.role_title or "חייל",
        "period": f"{window_from.strftime('%d/%m/%Y')} - {window_to.strftime('%d/%m/%Y')}",
        "computed_facts": facts,
        "daily_reports": lines,
    }
    return Case(soldier.id, state, facts)


def load_cases(db: Session, soldier_ids: list[int], window_from: date, window_to: date) -> list[Case]:
    soldiers = db.scalars(select(User).where(User.id.in_(soldier_ids)).order_by(User.id)).all()
    reports: dict[int, list[AttendanceReport]] = {sid: [] for sid in soldier_ids}
    for r in db.scalars(
        select(AttendanceReport)
        .options(
            joinedload(AttendanceReport.soldier_reason),
            joinedload(AttendanceReport.commander_reason),
            joinedload(AttendanceReport.hr_reason),
        )
        .where(
            AttendanceReport.soldier_id.in_(soldier_ids),
            AttendanceReport.report_date >= window_from,
            AttendanceReport.report_date <= window_to,
        )
    ).unique():
        reports[r.soldier_id].append(r)
    return [build_case(s, reports[s.id], window_from, window_to) for s in soldiers]


# ---------------------------------------------------------------- Jev

def make_client() -> AsyncTypeSafeClient:
    s = get_settings()
    return AsyncTypeSafeClient(api_key=s.typesafe_api_key, model=s.jev_model, timeout=30.0)


async def _score(client: AsyncTypeSafeClient, sem: asyncio.Semaphore, case: Case) -> tuple[Case, dict | None, int]:
    async with sem:
        try:
            r = await client.system_one(state=case.state, questions=QUESTIONS)
        except Exception:
            log.exception("jev scoring failed for soldier %s", case.soldier_id)
            return case, None, 0
    a = r.answers
    return (
        case,
        {
            "score": max(a[k].noul for k in SIGNALS),
            "severity": a["severity"].score,
            "signals": {k: a[k].noul for k in SIGNALS},
        },
        r.usage.input_tokens if r.usage else 0,
    )


def is_flagged(result: dict) -> bool:
    return result["score"] >= get_settings().anomaly_threshold


# ---------------------------------------------------------------- run

def _claim_run(run_date: date, window_from: date, window_to: date, unit_id: int | None, trigger: str) -> int | None:
    """Create the run row. For the nightly run returns None if that date was already claimed."""
    with SessionLocal() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": LOCK_KEY})
        stmt = insert(AnomalyRun).values(
            run_date=run_date, window_from=window_from, window_to=window_to, unit_id=unit_id, trigger=trigger,
            model=get_settings().jev_model, checked_count=0, flagged_count=0, failed_count=0, input_tokens=0,
        )
        if unit_id is None:
            stmt = stmt.on_conflict_do_nothing(index_elements=["run_date"], index_where=text("unit_id IS NULL"))
        run_id = db.execute(stmt.returning(AnomalyRun.id)).scalar()
        db.commit()
        return run_id


def _soldier_ids(unit_id: int | None) -> list[int]:
    with SessionLocal() as db:
        stmt = select(User.id).where(User.is_active)
        if unit_id is not None:
            stmt = stmt.where(User.unit_id.in_(unit_subtree_ids(db, unit_id)))
        return list(db.scalars(stmt.order_by(User.id)).all())


def _first_report_date() -> date | None:
    with SessionLocal() as db:
        return db.scalar(select(func.min(AttendanceReport.report_date)))


def _load(ids: list[int], window_from: date, window_to: date) -> list[Case]:
    with SessionLocal() as db:
        return load_cases(db, ids, window_from, window_to)


def _save(run_id: int, results: list[tuple[Case, dict | None, int]], finished: bool) -> None:
    flagged = [(c, res) for c, res, _ in results if res is not None and is_flagged(res)]
    with SessionLocal() as db:
        for c, res in flagged:
            db.add(SoldierAnomaly(run_id=run_id, soldier_id=c.soldier_id, facts=c.facts, **res))
        db.execute(
            update(AnomalyRun)
            .where(AnomalyRun.id == run_id)
            .values(
                checked_count=AnomalyRun.checked_count + sum(1 for _, res, _ in results if res is not None),
                failed_count=AnomalyRun.failed_count + sum(1 for _, res, _ in results if res is None),
                flagged_count=AnomalyRun.flagged_count + len(flagged),
                input_tokens=AnomalyRun.input_tokens + sum(t for _, _, t in results),
                finished_at=utcnow() if finished else None,
            )
        )
        db.commit()


async def run_anomaly_scan(run_date: date, unit_id: int | None = None, trigger: str = "nightly") -> dict | None:
    """Scan every active soldier (or one unit's subtree). Window = the N days before run_date, but never before the
    first report in the system (days before go-live are not "unreported"). Returns None if skipped."""
    s = get_settings()
    window_to = run_date - timedelta(days=1)
    window_from = run_date - timedelta(days=s.anomaly_lookback_days)
    first = await asyncio.to_thread(_first_report_date)
    if first is not None:
        window_from = min(max(window_from, first), window_to)
    run_id = await asyncio.to_thread(_claim_run, run_date, window_from, window_to, unit_id, trigger)
    if run_id is None:
        return None

    # Nothing reported yet in the window: nothing to scan.
    ids = await asyncio.to_thread(_soldier_ids, unit_id) if first is not None and first <= window_to else []
    sem = asyncio.Semaphore(s.anomaly_concurrency)
    client = make_client()
    try:
        if not ids:
            await asyncio.to_thread(_save, run_id, [], True)
        for i in range(0, len(ids), CHUNK):
            cases = await asyncio.to_thread(_load, ids[i : i + CHUNK], window_from, window_to)
            results = await asyncio.gather(*(_score(client, sem, c) for c in cases))
            await asyncio.to_thread(_save, run_id, results, i + CHUNK >= len(ids))
    finally:
        await client.aclose()

    with SessionLocal() as db:
        run = db.get(AnomalyRun, run_id)
        result = run_out(run)
    log.info("anomaly scan: %s", result)
    return result


def run_out(run: AnomalyRun) -> dict:
    return {
        "id": run.id,
        "run_date": run.run_date.isoformat(),
        "window_from": run.window_from.isoformat(),
        "window_to": run.window_to.isoformat(),
        "trigger": run.trigger,
        "model": run.model,
        "finished_at": run.finished_at,
        "checked": run.checked_count,
        "flagged": run.flagged_count,
        "failed": run.failed_count,
        "input_tokens": run.input_tokens,
        "cost_usd": round(run.input_tokens * PRICE_PER_M_INPUT_TOKENS / 1_000_000, 6),
    }
