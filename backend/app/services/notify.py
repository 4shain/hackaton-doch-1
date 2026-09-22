from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Notification


def notify(
    db: Session,
    user_id: int,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    dedupe_key: str | None = None,
) -> bool:
    """Create an in-app notification. With a dedupe_key the insert is idempotent. Returns True if created."""
    stmt = insert(Notification).values(
        user_id=user_id, kind=kind, title=title, body=body, link=link, dedupe_key=dedupe_key
    )
    if dedupe_key:
        stmt = stmt.on_conflict_do_nothing(index_elements=["dedupe_key"])
    return db.execute(stmt.returning(Notification.id)).scalar() is not None
