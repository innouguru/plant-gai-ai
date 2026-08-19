"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]
_BACKEND_ROOT = _REPO_ROOT / "backend"


class Settings(BaseSettings):
    """Runtime configuration. Values come from env vars or local .env files."""

    model_config = SettingsConfigDict(
        env_file=(_BACKEND_ROOT / ".env", _REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    debug: bool = False
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"

    # Frontend origin used as the post-signup/invite redirect target.
    frontend_origin: str = "http://localhost:5173"

    # Supabase configuration. Empty until a real project is connected.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    model_weights_path: str = "model/weights/plant_disease_resnet18_best.pth"
    model_version: str = "1.0.0"
    model_device: str = "cpu"

    rate_limit_enabled: bool = True
    rate_limit_storage: str = "redis"
    rate_limit_redis_url: str = ""
    rate_limit_fail_mode: str = "closed"
    rate_limit_global_per_minute: int = Field(default=120, gt=0)
    rate_limit_diagnosis_per_minute: int = Field(default=5, gt=0)
    rate_limit_invitations_per_hour: int = Field(default=10, gt=0)
    rate_limit_onboarding_per_hour: int = Field(default=5, gt=0)
    rate_limit_invitation_accept_per_hour: int = Field(default=5, gt=0)
    rate_limit_messages_per_minute: int = Field(default=30, gt=0)
    rate_limit_reads_per_minute: int = Field(default=120, gt=0)
    rate_limit_unauthenticated_per_minute: int = Field(default=20, gt=0)

    @field_validator("rate_limit_storage")
    @classmethod
    def validate_rate_limit_storage(cls, value: str) -> str:
        value = value.lower()
        if value not in {"redis", "memory"}:
            raise ValueError("RATE_LIMIT_STORAGE must be 'redis' or 'memory'.")
        return value

    @field_validator("rate_limit_fail_mode")
    @classmethod
    def validate_rate_limit_fail_mode(cls, value: str) -> str:
        value = value.lower()
        if value not in {"closed", "open"}:
            raise ValueError("RATE_LIMIT_FAIL_MODE must be 'closed' or 'open'.")
        return value

    @model_validator(mode="after")
    def validate_rate_limit_deployment(self):
        local_envs = {"development", "dev", "test", "testing"}
        if self.rate_limit_enabled and self.app_env.lower() not in local_envs:
            if self.rate_limit_storage != "redis" or not self.rate_limit_redis_url:
                raise ValueError("Enabled rate limiting requires Redis in deployed environments.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(
            self.supabase_url
            and self.supabase_anon_key
            and self.supabase_service_role_key
            and self.supabase_jwt_secret
        )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()