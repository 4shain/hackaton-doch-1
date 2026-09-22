"""Demo seed data. All people, units and reports are fictional."""

import random
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import (
    AttendanceReason,
    AttendanceReport,
    HrAssignment,
    ReportAuditEvent,
    ReportState,
    Unit,
    User,
)
from app.timeutil import local_today, utcnow

# Demo values only - not an official or exhaustive list of IDF attendance statuses.
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


def reset(db: Session) -> None:
    db.execute(
        text(
            "TRUNCATE auth_sessions, notifications, checkin_responses, checkin_requests, report_audit_events, "
            "attendance_reports, hr_assignments, daily_job_runs, attendance_reasons RESTART IDENTITY CASCADE"
        )
    )
    db.execute(text("UPDATE units SET commander_id = NULL"))
    db.execute(text("TRUNCATE users, units RESTART IDENTITY CASCADE"))
    db.commit()


def seed(db: Session, force: bool = False) -> bool:
    if db.query(User).count() and not force:
        return False
    if force:
        reset(db)

    reasons = {}
    for i, (code, label, desc, present, notes, icon) in enumerate(REASONS):
        r = AttendanceReason(code=code, label=label, description=desc, is_present=present, requires_notes=notes, icon=icon, sort_order=i)
        db.add(r)
        reasons[code] = r

    battalion = Unit(name="גדוד 71")
    db.add(battalion)
    db.flush()
    company = Unit(name="פלוגה א׳", parent_id=battalion.id)
    hr_office = Unit(name="שלישות גדודית", parent_id=battalion.id)
    db.add_all([company, hr_office])
    db.flush()

    def user(pn: str, name: str, rank: str, title: str, unit: Unit, cmdr: User | None) -> User:
        u = User(personal_number=pn, full_name=name, rank=rank, role_title=title, unit_id=unit.id, commander_id=cmdr.id if cmdr else None)
        db.add(u)
        db.flush()
        return u

    ron = user("1000001", "רון ברק", "סא״ל", "מפקד גדוד", battalion, None)
    yael = user("1000002", "יעל מזרחי", "סרן", "מפקדת פלוגה", company, ron)
    omer = user("1000003", "עומר לוי", "סמ״ר", "מפקד צוות 1", company, yael)
    noa = user("1000004", "נועה אלקיים", "סמ״ר", "מפקדת צוות 2", company, yael)
    dana = user("1000005", "דנה אלון", "רס״ן", "ראש שלישות", hr_office, ron)
    michal = user("1000006", "מיכל פרץ", "סמל", "פקידת שלישות", hr_office, dana)
    user("1000007", "אור חדד", "רב״ט", "פקיד כוח אדם", hr_office, dana)

    team1 = [
        user("8941203", "איתי כהן", "רב״ט", "לוחם", company, omer),
        user("8921345", "יונתן שפירא", "סמל", "קשר מ״פ", company, omer),
        user("9348122", "דניאל אברג׳יל", "רב״ט", "נהג מבצעי", company, omer),
        user("8112345", "גיא מזרחי", "סמ״ר", "חימוש", company, omer),
        user("7654129", "יובל אלון", "סמל", "קשר וסיוע", company, omer),
    ]
    team2 = [
        user("9104821", "שירה גולן", "רב״ט", "חובשת פלוגתית", company, noa),
        user("9023311", "עידו רוזן", "טוראי", "לוחם", company, noa),
        user("9187654", "מאיה ביטון", "רב״ט", "לוחמת", company, noa),
        user("9055512", "אלון דהן", "סמל", "מטול", company, noa),
    ]

    battalion.commander_id = ron.id
    company.commander_id = yael.id
    hr_office.commander_id = dana.id
    db.add_all([HrAssignment(user_id=dana.id, unit_id=company.id), HrAssignment(user_id=michal.id, unit_id=company.id)])
    db.flush()

    _seed_reports(db, reasons, company_soldiers=[yael, omer, noa, *team1, *team2], team1=team1, team2=team2, michal=michal)
    db.commit()
    return True


def _seed_reports(db: Session, reasons: dict, company_soldiers: list[User], team1: list[User], team2: list[User], michal: User) -> None:
    rng = random.Random(71)
    today = local_today()
    now = utcnow()
    weights = [("at_base", 70), ("on_the_way", 5), ("vacation", 10), ("sick", 5), ("after_duty", 6), ("outside_duty", 4)]
    codes = [c for c, w in weights for _ in range(w)]

    def notes_for(code: str) -> str | None:
        return {"outside_duty": "קורס מפקדי כיתות", "medical": "בדיקה במרפאה", "other": "סידורים אישיים"}.get(code)

    def add(u: User, d, code: str, state: ReportState, by_commander: bool = False) -> AttendanceReport:
        r = AttendanceReport(soldier_id=u.id, report_date=d, state=state, created_by_id=u.id)
        reason = reasons[code]
        if by_commander:
            r.commander_reason_id = reason.id
            r.commander_notes = notes_for(code)
            r.commander_reported_by_id = u.commander_id
            r.commander_reported_at = now
            r.created_by_id = u.commander_id
        else:
            r.soldier_reason_id = reason.id
            r.soldier_notes = notes_for(code)
            r.soldier_reported_at = now
        if state in (ReportState.approved, ReportState.sent_to_hr, ReportState.hr_final):
            r.approved_by_id = u.commander_id
            r.approved_at = now
        if state in (ReportState.sent_to_hr, ReportState.hr_final):
            r.sent_to_hr_by_id = u.commander_id
            r.sent_to_hr_at = now
        if state != ReportState.scheduled:
            r.submitted_to_commander_at = now
        db.add(r)
        db.flush()
        db.add(
            ReportAuditEvent(
                report_id=r.id, soldier_id=u.id, report_date=d, actor_id=r.created_by_id,
                actor_role="commander" if by_commander else "soldier", action="seeded", changes={},
            )
        )
        return r

    # History: last 14 days, approved and handed to HR; a couple of gaps and one HR correction.
    for back in range(14, 0, -1):
        d = today - timedelta(days=back)
        for u in company_soldiers:
            if rng.random() < 0.04:
                continue  # historical missing report
            add(u, d, rng.choice(codes), ReportState.sent_to_hr)
    corrected = add(team2[1], today - timedelta(days=15), "at_base", ReportState.sent_to_hr)
    corrected.hr_reason_id = reasons["sick"].id
    corrected.hr_notes = "תוקן לפי אישור רפואי"
    corrected.hr_reported_by_id = michal.id
    corrected.hr_reported_at = now
    corrected.state = ReportState.hr_final

    # Today: a realistic mix for the demo.
    add(team1[3], today, "at_base", ReportState.pending_approval)
    add(team1[4], today, "vacation", ReportState.pending_approval)
    add(team2[0], today, "at_base", ReportState.approved)
    add(team2[2], today, "medical", ReportState.pending_approval).soldier_notes = "תור לאורתופד 10:30"
    add(team2[3], today, "at_base", ReportState.approved, by_commander=True)
    # Missing today: team1[0..2], team2[1] (and the commanders).

    # Future: scheduled reports for the demo soldier.
    add(team1[0], today + timedelta(days=2), "vacation", ReportState.scheduled)
    add(team1[0], today + timedelta(days=3), "vacation", ReportState.scheduled)
