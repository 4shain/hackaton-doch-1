import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_session, get_principal, get_token, revoke_session
from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import Unit, User
from app.seed import normalize_id
from app.services.scope import Principal, load_principal

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    id_number: str = Field(min_length=1, max_length=20)


def me_out(db: Session, p: Principal) -> dict:
    u = p.user
    hr_unit = db.get(Unit, p.hr_unit_id) if p.hr_unit_id else None
    commander = db.get(User, u.commander_id) if u.commander_id else None
    return {
        "id": u.id,
        "personal_number": u.personal_number,
        "full_name": u.full_name,
        "rank": u.rank,
        "role_title": u.role_title,
        "unit": {"id": u.unit.id, "name": u.unit.name},
        "commander": None if commander is None else {"id": commander.id, "full_name": commander.full_name},
        "capabilities": {
            "soldier": True,
            "commander": p.is_commander,
            "hr": p.is_hr,
        },
        "direct_report_count": len(p.direct_report_ids),
        "hr_unit": None if hr_unit is None else {"id": hr_unit.id, "name": hr_unit.name},
    }


@router.get("/config")
def auth_config() -> dict:
    s = get_settings()
    return {"id_login_enabled": s.id_login_enabled, "sso_configured": s.sso_configured, "environment": s.app_env}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)) -> dict:
    """Login by ת״ז. Accepts the number with or without its leading zeros."""
    if not get_settings().id_login_enabled:
        raise AppError("ID_LOGIN_DISABLED", 403)
    raw = re.sub(r"\D", "", body.id_number)
    user = db.scalar(select(User).where(User.personal_number.in_({raw, normalize_id(raw)}), User.is_active)) if raw else None
    if user is None:
        raise AppError("USER_NOT_FOUND", 404)
    token = create_session(db, user, "id")
    return {"token": token, "me": me_out(db, load_principal(db, user))}


@router.get("/sso/login")
def sso_login() -> dict:
    # Integration boundary: a real OIDC provider would redirect here, then call back with a code that the
    # backend exchanges for a verified identity -> create_session(db, user, "sso").
    raise AppError("SSO_NOT_CONFIGURED", 501)


@router.post("/logout")
def logout(token: str = Depends(get_token), db: Session = Depends(get_db)) -> dict:
    revoke_session(db, token)
    return {"ok": True}


@router.get("/me")
def me(p: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
    return me_out(db, p)

