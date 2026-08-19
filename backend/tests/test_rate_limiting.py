from io import BytesIO

import pytest
from PIL import Image
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.deps import get_diagnosis_service
from app.core.rate_limit import (
    InMemoryRateLimitStore,
    RateLimiter,
    RateLimitExceeded,
    RateLimitUnavailable,
    _key_part,
    build_rate_limiter,
    get_rate_limiter,
)
from app.core.config import Settings
from app.schemas.domain import Role
from app.main import app


class FakeInferenceService:
    model_version = "1.0.0"

    def preprocess(self, image_bytes):
        return "tensor"

    def predict(self, tensor):
        return {"class_index": 0, "class_name": "Cashew anthracnose", "confidence": 0.9}


class FailingStore:
    async def increment(self, key, window_seconds):
        raise ConnectionError("redis credentials must not escape")


def image_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color=(120, 200, 90)).save(buffer, format="JPEG")
    return buffer.getvalue()


@pytest.fixture()
def limited_client(provider):
    clock = [100.0]
    store = InMemoryRateLimitStore(clock=lambda: clock[0])
    limiter = RateLimiter(store)
    app.dependency_overrides[get_rate_limiter] = lambda: limiter
    try:
        with TestClient(app) as test_client:
            yield test_client, clock
    finally:
        app.dependency_overrides.pop(get_rate_limiter, None)


def test_in_memory_store_boundary_and_window_reset():
    clock = [0.0]
    store = InMemoryRateLimitStore(clock=lambda: clock[0])
    limiter = RateLimiter(store)

    import asyncio

    async def run():
        await limiter.check("user-1", 2, 60)
        await limiter.check("user-1", 2, 60)
        with pytest.raises(RateLimitExceeded) as error:
            await limiter.check("user-1", 2, 60)
        assert error.value.retry_after == 60
        clock[0] = 60.0
        await limiter.check("user-1", 2, 60)

    asyncio.run(run())


def test_separate_identities_have_separate_counters():
    store = InMemoryRateLimitStore(clock=lambda: 0.0)
    limiter = RateLimiter(store)

    import asyncio

    async def run():
        await limiter.check("diagnosis:user-1", 1, 60)
        await limiter.check("diagnosis:user-2", 1, 60)
        with pytest.raises(RateLimitExceeded):
            await limiter.check("diagnosis:user-1", 1, 60)

    asyncio.run(run())


def test_unauthenticated_requests_use_ip_fallback_and_429(limited_client):
    client, _ = limited_client
    for _ in range(20):
        assert client.get("/api/v1/auth/me").status_code == 401

    response = client.get("/api/v1/auth/me", headers={"X-Request-ID": "rate-limit-request"})

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many requests. Please try again later."}
    assert int(response.headers["Retry-After"]) >= 1
    assert response.headers["X-Request-ID"] == "rate-limit-request"


def test_invalid_authentication_uses_ip_fallback(limited_client):
    client, _ = limited_client
    headers = {"Authorization": "Bearer definitely-invalid"}

    for _ in range(20):
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 429


def test_diagnosis_limit_blocks_before_inference(limited_client, provider):
    client, _ = limited_client
    farmer = provider.seed_farmer(email="limited@example.com", farm_id="farm-1")
    from app.core.security import create_access_token
    import os

    access_token = create_access_token(
        sub=farmer.id,
        email=farmer.email,
        secret=os.environ["SUPABASE_JWT_SECRET"],
        expires_seconds=3600,
    )
    fake = FakeInferenceService()
    app.dependency_overrides[get_diagnosis_service] = lambda: fake
    try:
        for _ in range(5):
            response = client.post(
                "/api/v1/diagnosis",
                headers={"Authorization": f"Bearer {access_token}"},
                files={"image": ("leaf.jpg", image_bytes(), "image/jpeg")},
            )
            assert response.status_code == 200

        response = client.post(
            "/api/v1/diagnosis",
            headers={"Authorization": f"Bearer {access_token}"},
            files={"image": ("leaf.jpg", image_bytes(), "image/jpeg")},
        )
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1
        assert response.json()["detail"] == "Too many requests. Please try again later."
    finally:
        app.dependency_overrides.pop(get_diagnosis_service, None)


def test_rate_limiter_can_be_disabled():
    store = InMemoryRateLimitStore(clock=lambda: 0.0)
    limiter = RateLimiter(store, enabled=False)

    import asyncio

    async def run():
        for _ in range(5):
            await limiter.check("disabled", 1, 60)

    asyncio.run(run())


def test_redis_failure_closed_raises_controlled_error():
    limiter = RateLimiter(FailingStore(), fail_mode="closed")

    import asyncio

    async def run():
        with pytest.raises(RateLimitUnavailable):
            await limiter.check("key", 1, 60)

    asyncio.run(run())


def test_redis_failure_open_allows_request():
    limiter = RateLimiter(FailingStore(), fail_mode="open")

    import asyncio

    async def run():
        await limiter.check("key", 1, 60)

    asyncio.run(run())


def test_rate_limit_configuration_rejects_invalid_values():
    with pytest.raises(ValidationError):
        Settings(rate_limit_global_per_minute=0)
    with pytest.raises(ValidationError):
        Settings(rate_limit_storage="postgres")
    with pytest.raises(ValidationError):
        Settings(rate_limit_fail_mode="sometimes")


def test_production_rejects_process_local_storage(monkeypatch):
    with pytest.raises(ValidationError, match="requires Redis"):
        Settings(app_env="production", rate_limit_storage="memory")


def test_redis_failure_closed_returns_safe_503(client, provider, make_token):
    user = provider.seed_user(email="rate-limit@example.com", full_name="Rate Limit", role=Role.farmer)
    token = make_token(user.id, user.email)
    app.dependency_overrides[get_rate_limiter] = lambda: RateLimiter(FailingStore(), fail_mode="closed")
    try:
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}", "X-Request-ID": "redis-down"},
        )
    finally:
        app.dependency_overrides.pop(get_rate_limiter, None)

    assert response.status_code == 503
    assert response.json() == {"detail": "Rate limiting is temporarily unavailable. Please try again."}
    assert response.headers["X-Request-ID"] == "redis-down"


def test_rate_limit_key_parts_are_bounded_and_normalized():
    normalized = _key_part("user with secrets/and\ncontrol")

    assert normalized == "user_with_secrets_and_control"
    assert len(_key_part("x" * 500)) == 128
