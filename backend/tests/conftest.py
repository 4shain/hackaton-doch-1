import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://doch1:doch1@localhost:5433/doch1_test")
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["APP_ENV"] = "development"
os.environ["DEV_LOGIN_ENABLED"] = "true"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))

# Seeded personal numbers.
BATTALION_CMDR = "1000001"  # רון  - commander (recursive root)
COMPANY_CMDR = "1000002"  # יעל  - commander of team commanders
TEAM1_CMDR = "1000003"  # עומר - commander of team 1
TEAM2_CMDR = "1000004"  # נועה - commander of team 2
HR_AND_CMDR = "1000005"  # דנה  - HR of פלוגה א׳ + commander of HR office
HR_ONLY = "1000006"  # מיכל - HR of פלוגה א׳
PLAIN_HR_OFFICE = "1000007"  # אור - plain soldier in HR office (outside HR scope)
SOLDIER = "8941203"  # איתי - team 1, no report today
SOLDIER_PENDING = "8112345"  # גיא - team 1, pending today
SOLDIER_TEAM2 = "9023311"  # עידו - team 2, no report today


@pytest.fixture(scope="session", autouse=True)
def migrated():
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
def fresh_data(migrated):
    with SessionLocal() as db:
        seed(db, force=True)


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture
def client():
    return TestClient(app)


class As:
    """Tiny helper: an authenticated client for a given personal number."""

    def __init__(self, client: TestClient, pn: str):
        r = client.post("/api/auth/dev-login", json={"personal_number": pn})
        assert r.status_code == 200, r.text
        self.c = client
        self.me = r.json()["me"]
        self.h = {"Authorization": f"Bearer {r.json()['token']}"}

    def get(self, url, **kw):
        return self.c.get(url, headers=self.h, **kw)

    def post(self, url, json=None, **kw):
        return self.c.post(url, headers=self.h, json=json, **kw)


@pytest.fixture
def login(client):
    return lambda pn: As(client, pn)


@pytest.fixture
def reasons(client):
    return {r["code"]: r for r in client.get("/api/meta").json()["reasons"]}
