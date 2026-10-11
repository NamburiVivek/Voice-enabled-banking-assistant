"""
config.py - Centralised configuration via Pydantic Settings.
All secrets are loaded exclusively from environment variables / .env file.
NEVER hard-code secrets here.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Voxa Bank AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False                    # 🔒 Must be False in production

    # ── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str                    # 🔒 Set in env — min 32 char random string
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Supabase ─────────────────────────────────────────────────────────────
    SUPABASE_URL: str                      # 🔒 Set in env
    SUPABASE_ANON_KEY: str                 # 🔒 Set in env (anon/public key)
    SUPABASE_SERVICE_ROLE_KEY: str         # 🔒 Set in env — never expose client-side
    DATABASE_URL: str                      # 🔒 postgres://... connection string

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_GLOBAL: str = "60/minute"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
