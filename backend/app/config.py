from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://doch1:doch1@localhost:5433/doch1"
    # Demo login is only honoured when app_env == "development" AND this flag is true.
    dev_login_enabled: bool = True
    session_ttl_hours: int = 12
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    timezone: str = "Asia/Jerusalem"
    daily_job_hour: int = 8
    scheduler_enabled: bool = True
    # How far ahead soldiers may schedule future reports.
    max_future_days: int = 60

    # Placeholders for a real SSO provider (OIDC). Not implemented in the MVP.
    sso_issuer_url: str | None = None
    sso_client_id: str | None = None
    sso_client_secret: str | None = None

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def demo_login_active(self) -> bool:
        return self.app_env == "development" and self.dev_login_enabled

    @property
    def sso_configured(self) -> bool:
        return bool(self.sso_issuer_url and self.sso_client_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()
