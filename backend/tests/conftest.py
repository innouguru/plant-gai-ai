"""Shared test configuration.

Environment variables are set BEFORE importing the FastAPI app so that
settings are available without any real Supabase project.
"""

import os

import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost:9999")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")

from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import get_provider  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402
from tests.fakes import FakeDataProvider  # noqa: E402

get_settings.cache_clear()


@pytest.fixture()
def provider() -> FakeDataProvider:
    """A fresh in-memory data provider wired into the FastAPI app."""
    fake = FakeDataProvider()
    app.dependency_overrides[get_provider] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture()
def client(provider) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def make_token():
    """Factory that creates a valid Supabase-style access token."""

    def _factory(user_id: str, email: str = "", expires_seconds: int = 3600) -> str:
        return create_access_token(
            sub=user_id,
            email=email,
            secret=os.environ["SUPABASE_JWT_SECRET"],
            expires_seconds=expires_seconds,
        )

    return _factory