from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import AttendanceReport, Notification, ReportState, Unit, User
from app.services.daily_job import run_daily_job
from app.services.scope import set_unit_parent
from app.timeutil import local_today
from tests.conftest import (
    BATTALION_CMDR,
    COMPANY_CMDR,
    HR_AND_CMDR,
    HR_ONLY,
    PLAIN_HR_OFFICE,
    SOLDIER,
    SOLDIER_PENDING,
    SOLDIER_TEAM2,
    TEAM1_CMDR,
    TEAM2_CMDR,
)

TODAY = lambda: local_today()  # noqa: E731


def err(r):
    return r.json()["error"]["code"]


def user_id(db, pn):
    return db.scalar(select(User.id).where(User.personal_number == pn))


def roster_row(api, pn, path="/api/commander/roster", **params):
    rows = api.get(path, params=params).json()["rows"]
    return next(r for r in rows if r["soldier"]["personal_number"] == pn)


# ------------------------------------------------------------------ auth & roles

def test_unauthenticated_is_rejected(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_role_combinations(login):
    assert login(SOLDIER).me["capabilities"] == {"soldier": True, "commander": False, "hr": False}
    assert login(TEAM1_CMDR).me["capabilities"] == {"soldier": True, "commander": True, "hr": False}
    assert login(HR_ONLY).me["capabilities"] == {"soldier": True, "commander": False, "hr": True}
    assert login(HR_AND_CMDR).me["capabilities"] == {"soldier": True, "commander": True, "hr": True}


def test_client_role_claims_are_ignored(login):
    s = login(SOLDIER)
    r = s.c.get("/api/commander/roster", headers={**s.h, "X-Role": "commander"})
    assert r.status_code == 403 and err(r) == "NOT_A_COMMANDER"
    assert err(s.get("/api/hr/roster")) == "NOT_HR"


def test_dev_login_disabled_outside_development(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "app_env", "production")
    r = client.post("/api/auth/dev-login", json={"personal_number": SOLDIER})
    assert r.status_code == 403 and err(r) == "DEV_LOGIN_DISABLED"
    assert client.get("/api/auth/sso/login").status_code == 501


# ------------------------------------------------------------------ soldier reporting

def test_soldier_reports_at_base_goes_to_commander(login, reasons):
    s = login(SOLDIER)
    r = s.post("/api/my/reports", {"report_date": TODAY().isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "pending_approval"
    row = roster_row(login(TEAM1_CMDR), SOLDIER)
    assert row["report"]["state"] == "pending_approval"
    assert row["report"]["effective"]["source"] == "soldier"


def test_required_notes_enforced_on_backend(login, reasons):
    s = login(SOLDIER)
    body = {"report_date": TODAY().isoformat(), "reason_id": reasons["medical"]["id"], "notes": "   "}
    r = s.post("/api/my/reports", body)
    assert r.status_code == 422 and err(r) == "NOTES_REQUIRED"
    body["notes"] = "תור לרופא"
    assert s.post("/api/my/reports", body).status_code == 200
    # Reason without requires_notes accepts empty notes.
    ok = s.post("/api/my/reports", {"report_date": (TODAY() + timedelta(days=5)).isoformat(), "reason_id": reasons["vacation"]["id"]})
    assert ok.status_code == 200


def test_soldier_cannot_report_past(login, reasons):
    r = login(SOLDIER).post("/api/my/reports", {"report_date": (TODAY() - timedelta(days=1)).isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert err(r) == "PAST_DATE_NOT_ALLOWED"


def test_one_report_per_soldier_per_date(db, login, reasons):
    s = login(SOLDIER)
    d = TODAY().isoformat()
    s.post("/api/my/reports", {"report_date": d, "reason_id": reasons["at_base"]["id"]})
    s.post("/api/my/reports", {"report_date": d, "reason_id": reasons["vacation"]["id"]})
    sid = user_id(db, SOLDIER)
    assert db.scalar(select(func.count()).where(AttendanceReport.soldier_id == sid, AttendanceReport.report_date == TODAY())) == 1
    # And the database itself refuses a duplicate.
    db.add(AttendanceReport(soldier_id=sid, report_date=TODAY(), state=ReportState.pending_approval, created_by_id=sid))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_future_report_is_scheduled_then_activated_idempotently(db, login, reasons):
    s = login(SOLDIER)
    future = TODAY() + timedelta(days=1)
    r = s.post("/api/my/reports", {"report_date": future.isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert r.json()["state"] == "scheduled"

    first = run_daily_job(db, future)
    assert first["activated"] >= 1
    report = db.get(AttendanceReport, r.json()["id"])
    db.refresh(report)
    assert report.state == ReportState.pending_approval

    notif_count = db.scalar(select(func.count()).select_from(Notification))
    second = run_daily_job(db, future)
    assert second == {"run_date": future.isoformat(), "activated": 0, "reminders_sent": 0}
    assert db.scalar(select(func.count()).select_from(Notification)) == notif_count


def test_daily_job_reminds_missing_and_keeps_approved(db, login, reasons):
    run_daily_job(db, TODAY())
    sid = user_id(db, SOLDIER)
    assert db.scalar(select(func.count()).where(Notification.user_id == sid, Notification.kind == "report_reminder")) == 1
    approved_before = {
        r.id for r in db.scalars(select(AttendanceReport).where(AttendanceReport.report_date == TODAY(), AttendanceReport.state == ReportState.approved))
    }
    run_daily_job(db, TODAY())
    db.expire_all()
    approved_after = {
        r.id for r in db.scalars(select(AttendanceReport).where(AttendanceReport.report_date == TODAY(), AttendanceReport.state == ReportState.approved))
    }
    assert approved_before and approved_before == approved_after
    assert db.scalar(select(func.count()).where(Notification.user_id == sid, Notification.kind == "report_reminder")) == 1


# ------------------------------------------------------------------ commander

def test_commander_scope_is_direct_reports(login):
    team1 = login(TEAM1_CMDR)
    names = {r["soldier"]["personal_number"] for r in team1.get("/api/commander/roster").json()["rows"]}
    assert SOLDIER in names and SOLDIER_TEAM2 not in names
    # Company commander only sees the team commanders directly.
    company = {r["soldier"]["personal_number"] for r in login(COMPANY_CMDR).get("/api/commander/roster").json()["rows"]}
    assert company == {TEAM1_CMDR, TEAM2_CMDR}


def test_commander_cannot_touch_other_teams(db, login, reasons):
    other = login(TEAM2_CMDR)
    r = other.post("/api/commander/reports/on-behalf", {"soldier_id": user_id(db, SOLDIER), "report_date": TODAY().isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert r.status_code == 403 and err(r) == "NOT_YOUR_SOLDIER"
    pending = roster_row(login(TEAM1_CMDR), SOLDIER_PENDING)["report"]["id"]
    assert err(other.post(f"/api/commander/reports/{pending}/approve", {})) == "NOT_YOUR_SOLDIER"
    assert other.get(f"/api/commander/soldiers/{user_id(db, SOLDIER)}/history").status_code == 403


def test_commander_correct_and_approve_preserves_layers(login, reasons):
    cmdr = login(TEAM1_CMDR)
    rid = roster_row(cmdr, SOLDIER_PENDING)["report"]["id"]
    r = cmdr.post(f"/api/commander/reports/{rid}/approve", {"reason_id": reasons["on_the_way"]["id"], "notes": "יגיע ב-10"})
    body = r.json()
    assert body["state"] == "approved"
    assert body["soldier_layer"]["reason"]["code"] == "at_base"
    assert body["commander_layer"]["reason"]["code"] == "on_the_way"
    assert body["effective"] == {"source": "commander", "reason": body["commander_layer"]["reason"], "notes": "יגיע ב-10"}


def test_commander_on_behalf_is_attributed_to_commander(db, login, reasons):
    cmdr = login(TEAM1_CMDR)
    r = cmdr.post("/api/commander/reports/on-behalf", {"soldier_id": user_id(db, SOLDIER), "report_date": TODAY().isoformat(), "reason_id": reasons["at_base"]["id"]})
    body = r.json()
    assert body["soldier_layer"] is None
    assert body["commander_layer"]["by"]["personal_number"] == TEAM1_CMDR
    assert body["created_by"]["personal_number"] == TEAM1_CMDR


def test_commander_historical_edit_is_hr_only(db, login, reasons):
    cmdr = login(TEAM1_CMDR)
    r = cmdr.post("/api/commander/reports/on-behalf", {"soldier_id": user_id(db, SOLDIER), "report_date": (TODAY() - timedelta(days=2)).isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert err(r) == "COMMANDER_EDIT_TODAY_ONLY"


def test_material_soldier_edit_invalidates_approval(login, reasons):
    s = login(SOLDIER_PENDING)
    cmdr = login(TEAM1_CMDR)
    rid = roster_row(cmdr, SOLDIER_PENDING)["report"]["id"]
    cmdr.post(f"/api/commander/reports/{rid}/approve", {"reason_id": reasons["on_the_way"]["id"]})
    r = s.post("/api/my/reports", {"report_date": TODAY().isoformat(), "reason_id": reasons["sick"]["id"]})
    body = r.json()
    assert body["state"] == "pending_approval"
    assert body["approved_by"] is None and body["commander_layer"] is None
    # Resubmitting the same values is a no-op and does not invalidate.
    cmdr.post(f"/api/commander/reports/{rid}/approve", {})
    same = s.post("/api/my/reports", {"report_date": TODAY().isoformat(), "reason_id": reasons["sick"]["id"]})
    assert same.json()["state"] == "approved"


def test_send_to_hr_requires_approval(login):
    cmdr = login(TEAM1_CMDR)
    rid = roster_row(cmdr, SOLDIER_PENDING)["report"]["id"]
    assert err(cmdr.post("/api/commander/reports/send-to-hr", {"report_ids": [rid]})) == "REPORT_NOT_APPROVED"
    cmdr.post(f"/api/commander/reports/{rid}/approve", {})
    assert cmdr.post("/api/commander/reports/send-to-hr", {"report_ids": [rid]}).json() == {"sent": 1}
    row = roster_row(login(HR_ONLY), SOLDIER_PENDING, path="/api/hr/roster")
    assert row["report"]["state"] == "sent_to_hr"


# ------------------------------------------------------------------ HR

def test_hr_scope_is_assigned_unit_only(db, login, reasons):
    hr = login(HR_ONLY)
    pns = {r["soldier"]["personal_number"] for r in hr.get("/api/hr/roster").json()["rows"]}
    assert SOLDIER in pns and PLAIN_HR_OFFICE not in pns and BATTALION_CMDR not in pns
    r = hr.post("/api/hr/reports", {"soldier_id": user_id(db, PLAIN_HR_OFFICE), "report_date": TODAY().isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert r.status_code == 403 and err(r) == "NOT_IN_HR_UNIT"


def test_hr_historical_edit_keeps_layers_and_locks(db, login, reasons):
    hr = login(HR_ONLY)
    past = TODAY() - timedelta(days=3)
    sid = user_id(db, SOLDIER_PENDING)
    before = hr.get(f"/api/hr/soldiers/{sid}/history").json()["reports"]
    old = next(r for r in before if r["report_date"] == past.isoformat())
    r = hr.post("/api/hr/reports", {"soldier_id": sid, "report_date": past.isoformat(), "reason_id": reasons["other"]["id"], "notes": "תיקון"})
    body = r.json()
    assert body["id"] == old["id"] and body["state"] == "hr_final"
    assert body["soldier_layer"] == old["soldier_layer"]
    assert body["effective"]["source"] == "hr"
    audit = hr.get(f"/api/hr/reports/{body['id']}/audit").json()
    last = audit[-1]
    assert last["actor"]["full_name"] == "מיכל פרץ" and last["actor_role"] == "hr"
    assert last["changes"]["hr_reason_id"]["to"] == reasons["other"]["id"]


def test_hr_final_blocks_soldier_and_commander(db, login, reasons):
    hr = login(HR_ONLY)
    sid = user_id(db, SOLDIER_PENDING)
    hr.post("/api/hr/reports", {"soldier_id": sid, "report_date": TODAY().isoformat(), "reason_id": reasons["at_base"]["id"]})
    assert err(login(SOLDIER_PENDING).post("/api/my/reports", {"report_date": TODAY().isoformat(), "reason_id": reasons["sick"]["id"]})) == "REPORT_LOCKED_BY_HR"
    rid = roster_row(login(TEAM1_CMDR), SOLDIER_PENDING)["report"]["id"]
    assert err(login(TEAM1_CMDR).post(f"/api/commander/reports/{rid}/approve", {})) == "REPORT_LOCKED_BY_HR"


def test_hr_required_notes(db, login, reasons):
    r = login(HR_ONLY).post("/api/hr/reports", {"soldier_id": user_id(db, SOLDIER), "report_date": TODAY().isoformat(), "reason_id": reasons["medical"]["id"]})
    assert err(r) == "NOTES_REQUIRED"


def test_csv_export_scoped_and_excel_friendly(login):
    hr = login(HR_AND_CMDR)
    d0 = (TODAY() - timedelta(days=2)).isoformat()
    r = hr.get("/api/hr/export.csv", params={"date_from": d0, "date_to": TODAY().isoformat()})
    assert r.status_code == 200
    assert r.content.startswith("﻿".encode())
    text = r.content.decode("utf-8-sig")
    assert text.splitlines()[0].startswith("תאריך,מספר אישי,שם מלא")
    assert SOLDIER in text and PLAIN_HR_OFFICE not in text
    assert "לא דווח" in text  # missing reports are exported as missing, not absent
    assert login(TEAM1_CMDR).get("/api/hr/export.csv", params={"date_from": d0, "date_to": d0}).status_code == 403


def test_combined_role_keeps_both_scopes(login):
    dana = login(HR_AND_CMDR)
    cmd = {r["soldier"]["personal_number"] for r in dana.get("/api/commander/roster").json()["rows"]}
    hr = {r["soldier"]["personal_number"] for r in dana.get("/api/hr/roster").json()["rows"]}
    assert PLAIN_HR_OFFICE in cmd and SOLDIER not in cmd
    assert SOLDIER in hr and PLAIN_HR_OFFICE not in hr
    assert dana.get("/api/my/reports").status_code == 200


# ------------------------------------------------------------------ ירוק בעיניים

def test_checkin_recipients_are_recursive_snapshot(db, login):
    ron = login(BATTALION_CMDR)
    created = ron.post("/api/checkins", {"message": "בדיקה"}).json()
    recipients = {r["recipient"]["personal_number"] for r in created["responses"]}
    assert {COMPANY_CMDR, TEAM1_CMDR, SOLDIER, SOLDIER_TEAM2, HR_ONLY, PLAIN_HR_OFFICE} <= recipients
    assert BATTALION_CMDR not in recipients
    assert created["total"] == db.scalar(select(func.count()).select_from(User)) - 1

    # Team commander: only own team.
    omer = login(TEAM1_CMDR).post("/api/checkins", {}).json()
    assert {r["recipient"]["personal_number"] for r in omer["responses"]} == {
        r["soldier"]["personal_number"] for r in login(TEAM1_CMDR).get("/api/commander/roster").json()["rows"]
    }

    # Snapshot: a soldier moved later is not added to the old request.
    soldier = db.scalar(select(User).where(User.personal_number == SOLDIER))
    soldier.commander_id = user_id(db, TEAM2_CMDR)
    db.commit()
    again = login(TEAM1_CMDR).get(f"/api/checkins/{omer['id']}").json()
    assert SOLDIER in {r["recipient"]["personal_number"] for r in again["responses"]}


def test_checkin_round_trip_and_isolation(db, login):
    s = login(SOLDIER)
    cmdr = login(TEAM1_CMDR)
    a = cmdr.post("/api/checkins", {"message": "א"}).json()
    b = cmdr.post("/api/checkins", {"message": "ב"}).json()
    assert db.scalar(select(func.count()).where(Notification.user_id == s.me["id"], Notification.kind == "checkin_request")) == 2

    assert err(s.post(f"/api/checkins/{a['id']}/respond", {"location_text": "  "})) == "LOCATION_REQUIRED"
    assert s.post(f"/api/checkins/{a['id']}/respond", {"location_text": "בבית בחיפה"}).status_code == 200
    assert s.post(f"/api/checkins/{a['id']}/respond", {"location_text": "בדרך לבסיס"}).status_code == 200

    da = cmdr.get(f"/api/checkins/{a['id']}").json()
    db_ = cmdr.get(f"/api/checkins/{b['id']}").json()
    mine = next(r for r in da["responses"] if r["recipient"]["personal_number"] == SOLDIER)
    assert mine["location_text"] == "בדרך לבסיס" and da["responded"] == 1
    assert db_["responded"] == 0

    # Check-in never touches attendance.
    assert db.scalar(select(func.count()).where(AttendanceReport.soldier_id == s.me["id"], AttendanceReport.report_date == TODAY())) == 0

    # Other commanders / non-recipients are rejected; closed requests refuse answers.
    assert login(TEAM2_CMDR).get(f"/api/checkins/{a['id']}").status_code == 403
    assert err(login(SOLDIER_TEAM2).post(f"/api/checkins/{a['id']}/respond", {"location_text": "x"})) == "NOT_A_RECIPIENT"
    cmdr.post(f"/api/checkins/{a['id']}/close")
    assert err(s.post(f"/api/checkins/{a['id']}/respond", {"location_text": "x"})) == "CHECKIN_CLOSED"


def test_plain_soldier_cannot_issue_checkin(login):
    assert err(login(SOLDIER).post("/api/checkins", {})) == "NOT_A_COMMANDER"


# ------------------------------------------------------------------ hierarchy

def test_unit_hierarchy_cycle_prevented(db):
    from app.errors import AppError

    root = db.scalar(select(Unit).where(Unit.parent_id.is_(None)))
    child = db.scalar(select(Unit).where(Unit.parent_id == root.id))
    with pytest.raises(AppError) as e:
        set_unit_parent(db, root, child.id)
    assert e.value.code == "UNIT_HIERARCHY_CYCLE"


def test_notifications_read_state(login):
    cmdr = login(TEAM1_CMDR)
    cmdr.post("/api/checkins", {})
    s = login(SOLDIER)
    data = s.get("/api/notifications").json()
    assert data["unread"] >= 1
    nid = data["items"][0]["id"]
    assert s.post(f"/api/notifications/{nid}/read").json()["read"] is True
    assert login(TEAM2_CMDR).post(f"/api/notifications/{nid}/read").status_code == 404
    s.post("/api/notifications/read-all")
    assert s.get("/api/notifications/unread-count").json()["unread"] == 0




# ------------------------------------------------------------------ ירוק בעיניים: mid-level commanders

def test_mid_commander_sees_own_subtree_and_resends(login):
    ron = login(BATTALION_CMDR)
    parent = ron.post("/api/checkins", {"message": "בדיקה גדודית"}).json()

    omer = login(TEAM1_CMDR)
    omer.post(f"/api/checkins/{parent['id']}/respond", {"location_text": "בבסיס"})
    login(SOLDIER).post(f"/api/checkins/{parent['id']}/respond", {"location_text": "בבית"})

    view = omer.get(f"/api/checkins/received/{parent['id']}").json()
    team1 = {r["soldier"]["personal_number"] for r in omer.get("/api/commander/roster").json()["rows"]}
    assert {r["recipient"]["personal_number"] for r in view["responses"]} == team1  # only my subtree
    assert view["responded"] == 1 and view["pending"] == len(team1) - 1
    assert view["my_response"]["location_text"] == "בבסיס"
    assert view["request"]["commander"]["full_name"] == "רון ברק"

    # Re-send down to my subordinates only, linked to the parent.
    child = omer.post("/api/checkins", {"parent_request_id": parent["id"]}).json()
    assert child["parent_request_id"] == parent["id"]
    assert {r["recipient"]["personal_number"] for r in child["responses"]} == team1
    assert omer.get(f"/api/checkins/received/{parent['id']}").json()["resends"][0]["id"] == child["id"]
    # The top commander still sees everyone's answers on the original request.
    assert ron.get(f"/api/checkins/{parent['id']}").json()["responded"] == 2


def test_resend_requires_being_a_recipient_of_open_parent(login):
    omer_req = login(TEAM1_CMDR).post("/api/checkins", {}).json()
    noa = login(TEAM2_CMDR)
    assert err(noa.post("/api/checkins", {"parent_request_id": omer_req["id"]})) == "NOT_A_RECIPIENT"
    assert noa.get(f"/api/checkins/received/{omer_req['id']}").status_code == 403

    parent = login(COMPANY_CMDR).post("/api/checkins", {}).json()
    login(COMPANY_CMDR).post(f"/api/checkins/{parent['id']}/close")
    assert err(noa.post("/api/checkins", {"parent_request_id": parent["id"]})) == "CHECKIN_CLOSED"
    # Plain soldiers have no subtree view.
    assert login(SOLDIER).get("/api/checkins/received").status_code == 403


# ------------------------------------------------------------------ multi-day reporting

def test_range_report_fills_every_day_and_skips_hr_locked(db, login, reasons):
    s = login(SOLDIER)
    start = TODAY() + timedelta(days=1)
    # HR has finalised one day in the middle: it must not be overwritten.
    login(HR_ONLY).post("/api/hr/reports", {"soldier_id": s.me["id"], "report_date": (start + timedelta(days=2)).isoformat(), "reason_id": reasons["at_base"]["id"]})
    r = s.post("/api/my/reports/range", {"date_from": start.isoformat(), "date_to": (start + timedelta(days=4)).isoformat(), "reason_id": reasons["vacation"]["id"]})
    body = r.json()
    assert len(body["submitted"]) == 4 and body["skipped_locked"] == [(start + timedelta(days=2)).isoformat()]
    mine = {x["report_date"]: x for x in s.get("/api/my/reports").json()}
    assert mine[start.isoformat()]["state"] == "scheduled"
    assert mine[start.isoformat()]["effective"]["reason"]["code"] == "vacation"
    assert mine[(start + timedelta(days=2)).isoformat()]["effective"]["reason"]["code"] == "at_base"


def test_range_report_validates_before_writing(db, login, reasons):
    s = login(SOLDIER)
    count = lambda: db.scalar(select(func.count()).where(AttendanceReport.soldier_id == s.me["id"]))  # noqa: E731
    before = count()
    d0, d1 = TODAY().isoformat(), (TODAY() + timedelta(days=2)).isoformat()
    assert err(s.post("/api/my/reports/range", {"date_from": d0, "date_to": d1, "reason_id": reasons["medical"]["id"]})) == "NOTES_REQUIRED"
    assert err(s.post("/api/my/reports/range", {"date_from": d1, "date_to": d0, "reason_id": reasons["at_base"]["id"]})) == "INVALID_DATE_RANGE"
    far = (TODAY() + timedelta(days=40)).isoformat()
    assert err(s.post("/api/my/reports/range", {"date_from": d0, "date_to": far, "reason_id": reasons["at_base"]["id"]})) == "DATE_RANGE_TOO_LONG_REPORT"
    past = (TODAY() - timedelta(days=1)).isoformat()
    assert err(s.post("/api/my/reports/range", {"date_from": past, "date_to": d0, "reason_id": reasons["at_base"]["id"]})) == "PAST_DATE_NOT_ALLOWED"
    assert count() == before
