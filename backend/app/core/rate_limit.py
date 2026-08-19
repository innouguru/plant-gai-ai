"""Shared rate-limiting primitives for protected API operations."""

from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import UserContext, get_current_user, get_provider
from app.core.config import get_settings
from app.db.interface import DataProvider

RATE_LIMIT_HEADER = "Retry-After"
RATE_LIMIT_NAMESPACE = "plant-gai-ai"
MAX_RATE_LIMIT_KEY_PART_LENGTH = 128
_SAFE_KEY_PART = re.compile(r"[^A-Za-z0-9._:-]+")
_rate_limit_bearer = HTTPBearer(auto_error=False)


class RateLimitStore(Protocol):
    async def increment(self, key: str, window_seconds: int) -> tuple[int, int]: ...


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = max(1, retry_after)
        super().__init__("rate limit exceeded")


class RateLimitUnavailable(Exception):
    """Raised when a configured shared limiter cannot be reached."""


class InMemoryRateLimitStore:
    """Deterministic process-local store for development and tests only."""

    def __init__(self, clock=time.monotonic) -> None:
        self._clock = clock
        self._entries: dict[str, tuple[int, float]] = {}

    async def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        now = self._clock()
        count, reset_at = self._entries.get(key, (0, now))
        if now >= reset_at:
            count = 0
            reset_at = now + window_seconds
        count += 1
        self._entries[key] = (count, reset_at)
        return count, max(1, math.ceil(reset_at - now))


class RedisRateLimitStore:
    """Redis-backed atomic counter store for multi-process deployments."""

    _INCREMENT_SCRIPT = """
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return {count, redis.call('TTL', KEYS[1])}
    """

    def __init__(self, url: str) -> None:
        try:
            from redis.asyncio import Redis
        except ImportError as exc:  # pragma: no cover - dependency packaging guard
            raise RuntimeError("The redis package is required for Redis rate limiting.") from exc
        self._redis = Redis.from_url(url, decode_responses=False)

    async def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        result = await self._redis.eval(self._INCREMENT_SCRIPT, 1, key, window_seconds)
        return int(result[0]), max(1, int(result[1]))


@dataclass
class RateLimiter:
    store: RateLimitStore
    enabled: bool = True
    fail_mode: str = "closed"

    async def check(self, key: str, limit: int, window_seconds: int) -> None:
        if not self.enabled:
            return
        try:
            count, retry_after = await self.store.increment(key, window_seconds)
        except Exception as exc:
            if self.fail_mode == "open":
                return
            raise RateLimitUnavailable from exc
        if count > limit:
            raise RateLimitExceeded(retry_after)


def _key_part(value: str) -> str:
    normalized = _SAFE_KEY_PART.sub("_", value)[:MAX_RATE_LIMIT_KEY_PART_LENGTH]
    return normalized or "unknown"


def build_rate_limiter() -> RateLimiter:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return RateLimiter(InMemoryRateLimitStore(), enabled=False, fail_mode=settings.rate_limit_fail_mode)
    if settings.rate_limit_storage == "memory":
        if settings.app_env.lower() not in {"development", "dev", "test", "testing"}:
            raise RuntimeError("Process-local rate limiting is only allowed in local development and tests.")
        return RateLimiter(InMemoryRateLimitStore(), fail_mode=settings.rate_limit_fail_mode)
    if settings.rate_limit_storage != "redis" or not settings.rate_limit_redis_url:
        raise RuntimeError("Redis rate limiting requires RATE_LIMIT_REDIS_URL.")
    return RateLimiter(
        RedisRateLimitStore(settings.rate_limit_redis_url),
        fail_mode=settings.rate_limit_fail_mode,
    )


@lru_cache
def get_rate_limiter() -> RateLimiter:
    return build_rate_limiter()


def rate_limit(
    policy: str,
    limit: int,
    window_seconds: int,
    unauthenticated_limit: int,
    global_limit: int,
):
    """Create a dependency that limits by authenticated user or client IP."""

    async def dependency(
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(_rate_limit_bearer),
        provider: DataProvider = Depends(get_provider),
        limiter: RateLimiter = Depends(get_rate_limiter),
    ) -> None:
        settings = get_settings()
        context: UserContext | None = None
        if credentials is not None:
            try:
                context = get_current_user(request, credentials.credentials, provider)
            except HTTPException:
                pass

        if context is not None:
            environment = _key_part(settings.app_env)
            key = f"{RATE_LIMIT_NAMESPACE}:{environment}:{_key_part(policy)}:{_key_part(context.user_id)}"
            await limiter.check(key, limit, window_seconds)
            await limiter.check(
                f"{RATE_LIMIT_NAMESPACE}:{environment}:global:{_key_part(context.user_id)}",
                global_limit,
                60,
            )
        else:
            client_ip = request.client.host if request.client else "unknown"
            key = f"{RATE_LIMIT_NAMESPACE}:{_key_part(settings.app_env)}:unauthenticated:{_key_part(policy)}:{_key_part(client_ip)}"
            await limiter.check(key, unauthenticated_limit, 60)

    return dependency


def diagnosis_rate_limit():
    settings = get_settings()
    return rate_limit("diagnosis", settings.rate_limit_diagnosis_per_minute, 60, settings.rate_limit_unauthenticated_per_minute, settings.rate_limit_global_per_minute)


def invitations_rate_limit():
    settings = get_settings()
    return rate_limit("invitations", settings.rate_limit_invitations_per_hour, 3600, settings.rate_limit_unauthenticated_per_minute, settings.rate_limit_global_per_minute)


def onboarding_rate_limit():
    settings = get_settings()
    return rate_limit("onboarding", settings.rate_limit_onboarding_per_hour, 3600, settings.rate_limit_unauthenticated_per_minute, settings.rate_limit_global_per_minute)


def invitation_accept_rate_limit():
    settings = get_settings()
    return rate_limit("invitation_accept", settings.rate_limit_invitation_accept_per_hour, 3600, settings.rate_limit_unauthenticated_per_minute, settings.rate_limit_global_per_minute)


def messages_write_rate_limit():
    settings = get_settings()
    return rate_limit("messages_send", settings.rate_limit_messages_per_minute, 60, settings.rate_limit_unauthenticated_per_minute, settings.rate_limit_global_per_minute)


def authenticated_read_rate_limit(policy: str = "reads"):
    settings = get_settings()
    return rate_limit(policy, settings.rate_limit_reads_per_minute, 60, settings.rate_limit_unauthenticated_per_minute, settings.rate_limit_global_per_minute)
