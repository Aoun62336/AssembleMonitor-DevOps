"""
Application configuration loaded from environment variables via pydantic-settings.
Values are read from a .env file (or real environment) at startup.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    #  Application                                                         #
    # ------------------------------------------------------------------ #
    APP_NAME: str = "AssembleMonitor API"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = True

    API_V1_STR: str = "/api/v1"

    # ------------------------------------------------------------------ #
    #  Security / JWT                                                      #
    # ------------------------------------------------------------------ #
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_use_openssl_rand_hex_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ------------------------------------------------------------------ #
    #  Database                                                            #
    # ------------------------------------------------------------------ #
    DATABASE_URL: PostgresDsn  # e.g. postgresql+asyncpg://user:pass@host/db

    # Sync URL used by Alembic (swap asyncpg → psycopg2)
    @property
    def SYNC_DATABASE_URL(self) -> str:  # noqa: N802
        return str(self.DATABASE_URL).replace(
            "postgresql+asyncpg", "postgresql+psycopg2"
        ).replace("postgresql://", "postgresql+psycopg2://")

    # ------------------------------------------------------------------ #
    #  CORS                                                                #
    # ------------------------------------------------------------------ #
    CORS_ORIGINS: str | List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, v: object) -> object:
        if isinstance(v, str):
            # Clean up outer quotes and whitespace
            val = v.strip().strip("'\"").strip()
            # If it is formatted as a JSON array
            if val.startswith("[") and val.endswith("]"):
                try:
                    import json
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return [str(x).strip().strip("'\"") for x in parsed]
                except Exception:
                    pass
            # Fall back to splitting by comma (and strip brackets/quotes if any)
            clean_val = val.lstrip("[").rstrip("]")
            return [origin.strip().strip("'\"") for origin in clean_val.split(",") if origin.strip()]
        return v

    # ------------------------------------------------------------------ #
    #  File storage (future)                                               #
    # ------------------------------------------------------------------ #
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 20

    # ------------------------------------------------------------------ #
    #  AWS S3                                                              #
    # ------------------------------------------------------------------ #
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "assemble-monitor-bucket"

    # ------------------------------------------------------------------ #
    #  Email / SMTP                                                        #
    # ------------------------------------------------------------------ #
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()


settings: Settings = get_settings()
