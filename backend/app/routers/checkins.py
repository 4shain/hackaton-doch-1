from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_principal
from app.db import get_db
from app.errors import forbidden
from app.services import checkins as svc
from app.services.scope import Principal, recursive_subordinate_ids

router = APIRouter(prefix="/api/checkins", tags=["checkins"])


class CreateIn(BaseModel):
    message: str | None = Field(default=None, max_length=300)
    # Re-send a request received from above down to my own subordinates.
    parent_request_id: int | None = None


class RespondIn(BaseModel):
    location_text: str = Field(max_length=300)


def require_commander(p: Principal = Depends(get_principal)) -> Principal:
    if not p.is_commander:
        raise forbidden("NOT_A_COMMANDER")
    return p


@router.get("/incoming")
def incoming(p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> list[dict]:
    return [svc.incoming_out(r) for r in svc.list_incoming(db, p)]


@router.post("/{request_id}/respond")
def respond(request_id: int, body: RespondIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    resp = svc.respond(db, p, request_id, body.location_text)
    return {"request_id": request_id, "location_text": resp.location_text, "responded_at": resp.responded_at, "updated_at": resp.updated_at}


@router.get("/issued")
def issued(p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return {
        "subordinate_count": len(recursive_subordinate_ids(db, p.id)),
        "requests": [svc.request_summary(r) for r in svc.list_issued(db, p)],
    }


@router.get("/received")
def received(p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> list[dict]:
    """Requests I received from my commanders, with how my own subordinates are answering them."""
    return svc.list_received_as_commander(db, p)


@router.get("/received/{request_id}")
def received_one(request_id: int, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return svc.received_subtree(db, p, request_id)


@router.post("")
def create(body: CreateIn, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return svc.request_detail(svc.create_request(db, p, body.message, body.parent_request_id))


@router.get("/{request_id}")
def detail(request_id: int, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return svc.request_detail(svc.get_request_for_commander(db, p, request_id))


@router.post("/{request_id}/close")
def close(request_id: int, p: Principal = Depends(require_commander), db: Session = Depends(get_db)) -> dict:
    return svc.request_detail(svc.close_request(db, p, request_id))
