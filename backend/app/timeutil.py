from datetime import date, datetime, timezone

from app.config import get_settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def local_now() -> datetime:
    return datetime.now(get_settings().tz)


def local_today() -> date:
    return local_now().date()
