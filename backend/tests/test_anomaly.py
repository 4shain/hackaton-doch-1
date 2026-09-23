import asyncio
from datetime import timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select, text

from app.config import get_settings
from app.models import AnomalyRun, AttendanceReport, ReportState, User
from app.services import anomaly
from app.timeutil import local_today
from tests.conftest import HR_ONLY, SOLDIER


class FakeJev:
    """Stands in for AsyncTypeSafeClient: flags notes that say the soldier was at home."""

    def __init__(self):
        self.states = []

    async def system_one(self, state, questions):
        self.states.append(state)
        hit = any("הייתי בבית" in line for line in state["daily_reports"])
        answers = {k: SimpleNamespace(noul=0.9 if hit and k == "notes_mismatch" else 0.1) for k in anomaly.SIGNALS}
        answers["severity"] = SimpleNamespace(score=2.5 if hit else 0.3)
        return SimpleNamespace(answers=answers, usage=SimpleNamespace(input_tokens=1000))

    async def aclose(self):
        pass


@pytest.fixture
def jev(monkeypatch):
    fake = FakeJev()
    monkeypatch.setattr(anomaly, "make_client", lambda: fake)
    monkeypatch.setattr(get_settings(), "typesafe_api_key", "test-key")
    return fake


def test_nightly_scan_flags_and_is_idempotent(db, jev):
    first = asyncio.run(anomaly.run_anomaly_scan(local_today()))
    active = len(db.scalars(select(User.id).where(User.is_active)).all())
    assert first["checked"] == active and first["failed"] == 0
    assert first["flagged"] == 1  # the seeded "at base" + "I was home all day" note
    assert first["input_tokens"] == active * 1000
    assert len(jev.states[0]["daily_reports"]) == get_settings().anomaly_lookback_days
    # A second nightly run for the same date is skipped.
    assert asyncio.run(anomaly.run_anomaly_scan(local_today())) is None
    assert db.query(AnomalyRun).count() == 1


def test_hr_sees_only_own_unit_and_can_scan(login, jev):
    hr = login(HR_ONLY)
    assert hr.get("/api/hr/anomalies").json() == {"configured": True, "run": None, "items": []}
    body = hr.post("/api/hr/anomalies/scan").json()
    assert body["run"]["trigger"] == "manual"
    assert [i["soldier"]["personal_number"] for i in body["items"]] == ["9348122"]
    assert body["items"][0]["signals"] == ["notes_mismatch"]
    assert hr.get("/api/hr/anomalies").json()["items"] == body["items"]
    assert login(SOLDIER).get("/api/hr/anomalies").status_code == 403


def test_scan_requires_api_key(login, monkeypatch):
    monkeypatch.setattr(get_settings(), "typesafe_api_key", None)
    r = login(HR_ONLY).post("/api/hr/anomalies/scan")
    assert r.status_code == 503 and r.json()["error"]["code"] == "ANOMALY_SCAN_NOT_CONFIGURED"


def test_days_before_go_live_are_not_scanned(db, jev):
    db.execute(text("TRUNCATE attendance_reports CASCADE"))
    db.commit()
    assert asyncio.run(anomaly.run_anomaly_scan(local_today()))["checked"] == 0 and jev.states == []

    # First report ever was yesterday: the window starts there, not 20 days back.
    yesterday = local_today() - timedelta(days=1)
    s = db.scalar(select(User).where(User.personal_number == SOLDIER))
    db.add(AttendanceReport(soldier_id=s.id, report_date=yesterday, state=ReportState.sent_to_hr, created_by_id=s.id))
    db.commit()
    asyncio.run(anomaly.run_anomaly_scan(local_today(), trigger="manual", unit_id=s.unit_id))
    assert all(len(st["daily_reports"]) == 1 for st in jev.states) and jev.states
    assert all("אברג" not in st["soldier"] for st in jev.states)  # names are never sent
