"""Authentication boundary.

Identity is always resolved from a server-side session (opaque bearer token -> auth_sessions row).
Clients never send role claims; capabilities are computed from the database on every request.

Providers:
  * "sso"  - intended production path (OIDC). Not implemented: requires provider configuration.
  * "dev"  - development-only demo login. Refused unless APP_ENV=development and DEV_LOGIN_ENABLED=true.
"""

import hashlib
import secrets
from datetime import timedelta

from fastapi import Depends, Header
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import AuthSession, User
from app.services.scope import Principal, load_principal
from app.timeutil import utcnow


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, provider: str) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            token_hash=_hash(token),
            user_id=user.id,
            provider=provider,
            expires_at=utcnow() + timedelta(hours=get_settings().session_ttl_hours),
        )
    )
    db.commit()
    return token


def revoke_session(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == _hash(token)))
    db.commit()


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError("UNAUTHENTICATED", 401)
    return authorization[7:].strip()


def get_token(authorization: str | None = Header(default=None)) -> str:
    return _bearer(authorization)


def get_principal(token: str = Depends(get_token), db: Session = Depends(get_db)) -> Principal:
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == _hash(token)))
    if session is None or session.expires_at < utcnow():
        raise AppError("UNAUTHENTICATED", 401)
    if session.provider == "dev" and not get_settings().demo_login_active:
        raise AppError("UNAUTHENTICATED", 401)
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise AppError("UNAUTHENTICATED", 401)
    return load_principal(db, user)
