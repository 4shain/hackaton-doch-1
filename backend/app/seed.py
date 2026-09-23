"""Initial data: attendance reasons + the real roster (units, people, command tree, HR).

The roster holds real ID numbers, so it is never committed (the repo is public): it lives at ROSTER_PATH
(default data/roster.csv, gitignored) and is baked into the deploy image. CSV columns:

    full_name,id_number,team,role,role_title,hr

  role   soldier | team_commander | course_commander (exactly one course commander, one commander per team)
  team   team number (empty for the course commander)
  hr     1 = HR (שלישות) for the whole course

Resulting tree: course commander -> team commanders -> their soldiers. Units: קורס -> צוות N.
"""

import csv
import logging
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AttendanceReason, HrAssignment, Unit, User

log = logging.getLogger("doch1.seed")

# Not an official or exhaustive list of IDF attendance statuses.
REASONS = [
    # code, label, description, is_present, requires_notes, icon
    ("at_base", "נוכח בבסיס", "נוכחות מלאה ביחידה", True, False, "apartment"),
    ("outside_duty", "בתפקיד מחוץ ליחידה", "משימת חוץ / קורס / דיון", True, True, "badge"),
    ("on_the_way", "בדרך ליחידה", "נסיעה בתחבורה / פקקים", False, False, "directions_bus"),
    ("after_duty", "אחרי תורנות / משמרת", "מנוחה חוקית", False, False, "bedtime"),
    ("vacation", "חופשה", "חופשה מאושרת", False, False, "flight_takeoff"),
    ("sick", "יום מחלה (גימלים)", "באישור רופא", False, False, "healing"),
    ("medical", "הפנייה רפואית", "מרפאה / בית חולים", False, True, "local_hospital"),
    ("other", "אחר", "יש לפרט בהערות", False, True, "edit_note"),
]


def normalize_id(raw: str) -> str:
    """ת״ז as stored: digits only, left-padded to 9 (people often drop the leading zero)."""
    digits = re.sub(r"\D", "", raw or "")
    return digits.zfill(9) if digits else ""


def reset(db: Session) -> None:
    db.execute(
        text(
            "TRUNCATE soldier_anomalies, anomaly_runs, auth_sessions, notifications, checkin_responses, checkin_requests, report_audit_events, "
            "attendance_reports, hr_assignments, daily_job_runs, attendance_reasons RESTART IDENTITY CASCADE"
        )
    )
    db.execute(text("UPDATE units SET commander_id = NULL"))
    db.execute(text("TRUNCATE users, units RESTART IDENTITY CASCADE"))
    db.commit()


def seed_reasons(db: Session) -> dict[str, AttendanceReason]:
    reasons = {}
    for i, (code, label, desc, present, notes, icon) in enumerate(REASONS):
        r = AttendanceReason(code=code, label=label, description=desc, is_present=present, requires_notes=notes, icon=icon, sort_order=i)
        db.add(r)
        reasons[code] = r
    db.flush()
    return reasons


def import_roster(db: Session, path: Path) -> int:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    by_role: dict[str, list[dict]] = {}
    for r in rows:
        r["id_number"] = normalize_id(r["id_number"])
        by_role.setdefault(r["role"].strip(), []).append(r)
    ids = [r["id_number"] for r in rows]
    if len(set(ids)) != len(ids) or "" in ids:
        raise ValueError("roster: ID numbers must be present and unique")
    if len(by_role.get("course_commander", [])) != 1:
        raise ValueError("roster: expected exactly one course_commander")

    course = Unit(name="קורס")
    db.add(course)
    db.flush()

    def user(r: dict, unit: Unit, commander: User | None) -> User:
        u = User(
            personal_number=r["id_number"], full_name=r["full_name"].strip(), role_title=(r.get("role_title") or "").strip() or None,
            unit_id=unit.id, commander_id=commander.id if commander else None,
        )
        db.add(u)
        db.flush()
        if r.get("hr", "").strip() == "1":
            db.add(HrAssignment(user_id=u.id, unit_id=course.id))
        return u

    top = user(by_role["course_commander"][0], course, None)
    course.commander_id = top.id

    teams: dict[int, tuple[Unit, User]] = {}
    for r in sorted(by_role.get("team_commander", []), key=lambda r: int(r["team"])):
        n = int(r["team"])
        if n in teams:
            raise ValueError(f"roster: team {n} has more than one commander")
        unit = Unit(name=f"צוות {n}", parent_id=course.id)
        db.add(unit)
        db.flush()
        cmdr = user(r, unit, top)
        unit.commander_id = cmdr.id
        teams[n] = (unit, cmdr)

    for r in by_role.get("soldier", []):
        n = int(r["team"])
        if n not in teams:
            raise ValueError(f"roster: team {n} has no commander")
        user(r, *teams[n])
    db.flush()
    return len(rows)


def seed(db: Session, force: bool = False) -> bool:
    if db.query(User).count() and not force:
        return False
    if force:
        reset(db)
    if not db.query(AttendanceReason).count():
        seed_reasons(db)
    path = Path(get_settings().roster_path)
    if path.exists():
        log.info("imported %d people from the roster", import_roster(db, path))
    else:
        log.warning("roster file %s not found: no users created", path)
    db.commit()
    return True
