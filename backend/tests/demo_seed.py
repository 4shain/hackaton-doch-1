"""Fictional demo data for the tests. All people, units and reports are made up."""

import random
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import (
    AttendanceReport,
    HrAssignment,
    ReportAuditEvent,
    ReportState,
    Unit,
    User,
)
from app.seed import reset, seed_reasons
from app.timeutil import local_today, utcnow


def seed(db: Session, force: bool = False) -> bool:
    if db.query(User).count() and not force:
        return False
    if force:
        reset(db)

    reasons = seed_reasons(db)

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

    # History: last 20 days, approved and handed to HR; a couple of gaps and one HR correction.
    # Days 15-20 draw from their own RNG so the last 14 days stay identical to the original seed (tests rely on it).
    history: dict[tuple[int, int], AttendanceReport] = {}
    older_rng = random.Random(72)
    for back in range(20, 0, -1):
        d = today - timedelta(days=back)
        day_rng = older_rng if back > 14 else rng
        for u in company_soldiers:
            if day_rng.random() < 0.04 or (u is team2[1] and back == 15):
                continue  # historical missing report / HR-corrected day below
            history[(u.id, back)] = add(u, d, day_rng.choice(codes), ReportState.sent_to_hr)

    # Planted anomalies for the nightly Jev scan demo (kept 4+ days back, clear of the tests' days).
    def plant(u: User, back: int, code: str, notes: str | None = None, cmdr_code: str | None = None, cmdr_notes: str | None = None) -> None:
        r = history.get((u.id, back)) or add(u, today - timedelta(days=back), code, ReportState.sent_to_hr)
        history[(u.id, back)] = r
        r.soldier_reason_id, r.soldier_notes = reasons[code].id, notes
        if cmdr_code:
            r.commander_reason_id, r.commander_notes = reasons[cmdr_code].id, cmdr_notes
            r.commander_reported_by_id, r.commander_reported_at = u.commander_id, now

    daniel, alon = team1[2], team2[3]
    # Sick every Thursday / Sunday (around the weekend), and "at base" with a note saying he was home.
    for back in range(4, 21):
        if (today - timedelta(days=back)).weekday() in (3, 6):
            plant(daniel, back, "sick")
    plant(daniel, 5 if (today - timedelta(days=5)).weekday() not in (3, 6) else 6, "at_base", "הייתי בבית כל היום, הרכב התקלקל")
    # Soldier says at base, commander says he never showed up.
    plant(alon, 7, "at_base", None, "other", "לא הגיע לבסיס ולא ענה לטלפון")
    plant(alon, 8, "at_base", None, "other", "לא הגיע, לא ידוע איפה הוא")
    plant(alon, 12, "outside_duty", "קורס נהיגה", "vacation", "אין שום קורס, יצא הביתה")
    corrected = add(team2[1], today - timedelta(days=15), "at_base", ReportState.sent_to_hr)
    corrected.hr_reason_id = reasons["sick"].id
    corrected.hr_notes = "תוקן לפי אישור רפואי"
    corrected.hr_reported_by_id = michal.id
    corrected.hr_reported_at = now
    corrected.state = ReportState.hr_final

    # Today: a realistic mix for the demo.
    add(team1[3], today, "at_base", ReportState.pending_approval)
    add(team1[4], today, "vacation", ReportState.pending_approval)
    add(team2[0], today, "at_base", ReportState.sent_to_hr)
    add(team2[2], today, "medical", ReportState.pending_approval).soldier_notes = "תור לאורתופד 10:30"
    add(team2[3], today, "at_base", ReportState.sent_to_hr, by_commander=True)
    # Missing today: team1[0..2], team2[1] (and the commanders).

    # Future: scheduled reports for the demo soldier.
    add(team1[0], today + timedelta(days=2), "vacation", ReportState.scheduled)
    add(team1[0], today + timedelta(days=3), "vacation", ReportState.scheduled)
