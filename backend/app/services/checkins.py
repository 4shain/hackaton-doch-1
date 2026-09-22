"""ירוק בעיניים check-ins. Separate from attendance: responses never touch attendance reports."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.errors import AppError, forbidden, not_found
from app.models import CheckinRequest, CheckinResponse, User
from app.services.notify import notify
from app.services.scope import Principal, recursive_subordinate_ids
from app.timeutil import utcnow

LOCATION_MAX = 300


def create_request(db: Session, p: Principal, message: str | None, parent_request_id: int | None = None) -> CheckinRequest:
    """Issue a request to all recursive subordinates.

    With parent_request_id, a commander who *received* that request re-sends it down to their own
    subordinates (who are usually already recipients of the parent; one answer covers both).
    """
    if parent_request_id is not None:
        parent = my_received_response(db, p, parent_request_id).request
        if parent.closed_at is not None:
            raise AppError("CHECKIN_CLOSED", 409)
    recipients = recursive_subordinate_ids(db, p.id)
    if not recipients:
        raise AppError("NO_SUBORDINATES", 422)
    message = (message or "").strip()[:300] or None
    req = CheckinRequest(commander_id=p.id, message=message, parent_request_id=parent_request_id)
    db.add(req)
    db.flush()
    for uid in recipients:
        db.add(CheckinResponse(request_id=req.id, recipient_id=uid))
        notify(
            db,
            uid,
            "checkin_request",
            f"ירוק בעיניים: {p.user.full_name} מבקש/ת לדעת היכן את/ה",
            message,
            link="/checkin",
            dedupe_key=f"checkin:{req.id}:{uid}",
        )
    db.commit()
    return get_request(db, req.id)


def get_request(db: Session, request_id: int) -> CheckinRequest:
    req = db.scalar(
        select(CheckinRequest)
        .options(
            joinedload(CheckinRequest.commander),
            joinedload(CheckinRequest.responses).joinedload(CheckinResponse.recipient).joinedload(User.unit),
        )
        .where(CheckinRequest.id == request_id)
    )
    if req is None:
        raise not_found("CHECKIN_NOT_FOUND")
    return req


def get_request_for_commander(db: Session, p: Principal, request_id: int) -> CheckinRequest:
    req = get_request(db, request_id)
    if req.commander_id != p.id:
        raise forbidden("NOT_YOUR_CHECKIN")
    return req


def my_received_response(db: Session, p: Principal, request_id: int) -> CheckinResponse:
    resp = db.scalar(
        select(CheckinResponse)
        .options(joinedload(CheckinResponse.request).joinedload(CheckinRequest.commander))
        .where(CheckinResponse.request_id == request_id, CheckinResponse.recipient_id == p.id)
    )
    if resp is None:
        raise forbidden("NOT_A_RECIPIENT")
    return resp


def received_subtree(db: Session, p: Principal, request_id: int) -> dict:
    """For a commander who received a request: how their own (recursive) subordinates answered it,
    plus the re-sends they issued for it."""
    mine = my_received_response(db, p, request_id)
    subs = set(recursive_subordinate_ids(db, p.id))
    rows = db.scalars(
        select(CheckinResponse)
        .options(joinedload(CheckinResponse.recipient).joinedload(User.unit))
        .where(CheckinResponse.request_id == request_id, CheckinResponse.recipient_id.in_(subs))
    ).all() if subs else []
    responded = sum(1 for r in rows if r.responded_at is not None)
    resends = db.scalars(
        select(CheckinRequest)
        .options(joinedload(CheckinRequest.responses), joinedload(CheckinRequest.commander))
        .where(CheckinRequest.parent_request_id == request_id, CheckinRequest.commander_id == p.id)
        .order_by(CheckinRequest.created_at.desc())
    ).unique().all()
    return {
        "request": request_summary_light(mine.request),
        "my_response": {"location_text": mine.location_text, "responded_at": mine.responded_at},
        "total": len(rows),
        "responded": responded,
        "pending": len(rows) - responded,
        "responses": _response_rows(rows),
        "resends": [request_summary(r) for r in resends],
    }


def list_received_as_commander(db: Session, p: Principal) -> list[dict]:
    """Recent requests this commander received from above, with their subordinates' status."""
    ids = db.scalars(
        select(CheckinRequest.id)
        .join(CheckinResponse, CheckinResponse.request_id == CheckinRequest.id)
        .where(CheckinResponse.recipient_id == p.id)
        .order_by(CheckinRequest.closed_at.is_not(None), CheckinRequest.created_at.desc())
        .limit(10)
    ).all()
    return [received_subtree(db, p, i) for i in ids]


def respond(db: Session, p: Principal, request_id: int, location_text: str) -> CheckinResponse:
    location_text = (location_text or "").strip()
    if not location_text:
        raise AppError("LOCATION_REQUIRED", 422)
    if len(location_text) > LOCATION_MAX:
        raise AppError("LOCATION_TOO_LONG", 422)
    resp = db.scalar(
        select(CheckinResponse)
        .options(joinedload(CheckinResponse.request))
        .where(CheckinResponse.request_id == request_id, CheckinResponse.recipient_id == p.id)
        .with_for_update(of=CheckinResponse)
    )
    if resp is None:
        raise forbidden("NOT_A_RECIPIENT")
    if resp.request.closed_at is not None:
        raise AppError("CHECKIN_CLOSED", 409)
    now = utcnow()
    first = resp.responded_at is None
    resp.location_text = location_text
    if first:
        resp.responded_at = now
    resp.updated_at = now
    if first:
        notify(
            db,
            resp.request.commander_id,
            "checkin_response",
            f"ירוק בעיניים: {p.user.full_name} השיב/ה",
            location_text,
            link=f"/checkins?request={request_id}",
        )
    db.commit()
    return resp


def close_request(db: Session, p: Principal, request_id: int) -> CheckinRequest:
    req = get_request_for_commander(db, p, request_id)
    if req.closed_at is None:
        req.closed_at = utcnow()
        db.commit()
    return get_request(db, request_id)


def list_issued(db: Session, p: Principal) -> list[CheckinRequest]:
    return list(
        db.scalars(
            select(CheckinRequest)
            .options(joinedload(CheckinRequest.responses), joinedload(CheckinRequest.commander))
            .where(CheckinRequest.commander_id == p.id)
            .order_by(CheckinRequest.created_at.desc())
        ).unique()
    )


def list_incoming(db: Session, p: Principal) -> list[CheckinResponse]:
    return list(
        db.scalars(
            select(CheckinResponse)
            .join(CheckinRequest)
            .options(joinedload(CheckinResponse.request).joinedload(CheckinRequest.commander))
            .where(CheckinResponse.recipient_id == p.id)
            .order_by(CheckinRequest.closed_at.is_not(None), CheckinRequest.created_at.desc())
            .limit(50)
        ).unique()
    )


def request_summary(req: CheckinRequest) -> dict:
    total = len(req.responses)
    responded = sum(1 for r in req.responses if r.responded_at is not None)
    return {
        "id": req.id,
        "commander": {"id": req.commander.id, "full_name": req.commander.full_name},
        "message": req.message,
        "created_at": req.created_at,
        "closed_at": req.closed_at,
        "is_open": req.closed_at is None,
        "total": total,
        "responded": responded,
        "pending": total - responded,
        "parent_request_id": req.parent_request_id,
    }


def _response_rows(responses: list[CheckinResponse]) -> list[dict]:
    return [
        {
            "recipient": {
                "id": r.recipient.id,
                "full_name": r.recipient.full_name,
                "personal_number": r.recipient.personal_number,
                "rank": r.recipient.rank,
                "unit_name": r.recipient.unit.name if r.recipient.unit else None,
            },
            "location_text": r.location_text,
            "responded_at": r.responded_at,
            "updated_at": r.updated_at,
        }
        for r in sorted(responses, key=lambda x: (x.responded_at is not None, x.recipient.full_name))
    ]


def request_detail(req: CheckinRequest) -> dict:
    out = request_summary(req)
    out["responses"] = _response_rows(req.responses)
    return out


def incoming_out(resp: CheckinResponse) -> dict:
    return {
        "request": request_summary_light(resp.request),
        "location_text": resp.location_text,
        "responded_at": resp.responded_at,
        "updated_at": resp.updated_at,
    }


def request_summary_light(req: CheckinRequest) -> dict:
    return {
        "id": req.id,
        "parent_request_id": req.parent_request_id,
        "commander": {"id": req.commander.id, "full_name": req.commander.full_name},
        "message": req.message,
        "created_at": req.created_at,
        "closed_at": req.closed_at,
        "is_open": req.closed_at is None,
    }
