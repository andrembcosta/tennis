from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_url: str

    @field_validator("postgres_url")
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        if v.startswith("sqlite"):
            return v
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    secret_key: str
    resend_api_key: str = ""
    from_email: str = "tennis@yourdomain.com"
    frontend_url: str = "http://localhost:5173"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    class Config:
        env_file = ".env"


settings = Settings()
