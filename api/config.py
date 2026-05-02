from urllib.parse import urlparse, urlencode, urlunparse, parse_qs
from pydantic import field_validator
from pydantic_settings import BaseSettings

ASYNCPG_UNSUPPORTED_PARAMS = {"channel_binding"}


class Settings(BaseSettings):
    postgres_url: str

    @field_validator("postgres_url")
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        if v.startswith("sqlite"):
            return v
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        parsed = urlparse(v)
        params = {k: vals[0] for k, vals in parse_qs(parsed.query, keep_blank_values=True).items()
                  if k not in ASYNCPG_UNSUPPORTED_PARAMS}
        return urlunparse(parsed._replace(query=urlencode(params)))
    secret_key: str
    resend_api_key: str = ""
    from_email: str = "tennis@yourdomain.com"
    frontend_url: str = "http://localhost:5173"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
