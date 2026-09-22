from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import create_session, get_principal, get_token, revoke_session
from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import Unit, User
from app.services.scope import Principal, load_principal

router = APIRouter(prefix="/api/auth", tags=["auth"])


class DevLoginIn(BaseModel):
    personal_number: str = Field(min_length=1, max_length=20)


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
    return {"dev_login_enabled": s.demo_login_active, "sso_configured": s.sso_configured, "environment": s.app_env}


@router.get("/demo-users")
def demo_users(db: Session = Depends(get_db)) -> list[dict]:
    if not get_settings().demo_login_active:
        raise AppError("DEV_LOGIN_DISABLED", 403)
    users = db.scalars(select(User).options(joinedload(User.unit)).where(User.is_active).order_by(User.id)).all()
    out = []
    for u in users:
        p = load_principal(db, u)
        out.append(
            {
                "personal_number": u.personal_number,
                "full_name": u.full_name,
                "rank": u.rank,
                "role_title": u.role_title,
                "unit_name": u.unit.name,
                "capabilities": {"soldier": True, "commander": p.is_commander, "hr": p.is_hr},
            }
        )
    return out


@router.post("/dev-login")
def dev_login(body: DevLoginIn, db: Session = Depends(get_db)) -> dict:
    if not get_settings().demo_login_active:
        raise AppError("DEV_LOGIN_DISABLED", 403)
    user = db.scalar(select(User).where(User.personal_number == body.personal_number.strip(), User.is_active))
    if user is None:
        raise AppError("USER_NOT_FOUND", 404)
    token = create_session(db, user, "dev")
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

