from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.auth import get_principal
from app.db import get_db
from app.errors import not_found
from app.models import Notification
from app.services.scope import Principal
from app.timeutil import utcnow

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _out(n: Notification) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "read": n.read_at is not None,
        "created_at": n.created_at,
    }


@router.get("")
def list_notifications(p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    items = db.scalars(
        select(Notification).where(Notification.user_id == p.id).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(100)
    ).all()
    unread = db.scalar(select(func.count()).where(Notification.user_id == p.id, Notification.read_at.is_(None)))
    return {"unread": unread, "items": [_out(n) for n in items]}


@router.get("/unread-count")
def unread_count(p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    return {"unread": db.scalar(select(func.count()).where(Notification.user_id == p.id, Notification.read_at.is_(None)))}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != p.id:
        raise not_found("NOTIFICATION_NOT_FOUND")
    if n.read_at is None:
        n.read_at = utcnow()
        db.commit()
    return _out(n)


@router.post("/read-all")
def mark_all_read(p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    db.execute(
        update(Notification).where(Notification.user_id == p.id, Notification.read_at.is_(None)).values(read_at=utcnow())
    )
    db.commit()
    return {"ok": True}
