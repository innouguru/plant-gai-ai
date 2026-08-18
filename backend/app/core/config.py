"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

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