"""JWT verification for Supabase Auth access tokens.

The backend never issues its own tokens. It validates the access tokens
issued by Supabase Auth (ES256, signed with Supabase JWT Signing Keys)
and derives the application role from the user's profile row.

Legacy HS256 tokens are only accepted in non-production environments for
local tests that generate tokens with ``create_access_token``.
"""

from __future__ import annotations

import json
import time
import uuid

import httpx
import jwt
from fastapi import HTTPException, status

_EXPIRED_MESSAGE = "Your session has expired. Please log in again."
_INVALID_MESSAGE = "Invalid or missing access token."

_JWKS_CACHE_TTL_SECONDS = 600  # 10 minutes
_jwks_cache: dict | None = None
_jwks_cache_fetched_at: float = 0.0


def create_access_token(
    *,
    sub: str,
    email: str = "",
    secret: str,
    role: str = "authenticated",
    aud: str = "authenticated",
    expires_seconds: int = 3600,
) -> str:
    """Create a Supabase-style HS256 access token.

    Used by tests and local tooling. The application itself never issues
    tokens to end users. HS256 is only accepted in test/development
    environments.
    """
    now = int(time.time())
    payload = {
        "aud": aud,
        "role": role,
        "email": email,
        "exp": now + expires_seconds,
        "iat": now,
        "sub": str(sub),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _jwks_url() -> str:
    # Lazy import to avoid circular dependency at module import time.
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_MESSAGE,
        )
    return settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"


def _fetch_jwks() -> dict:
    url = _jwks_url()
    try:
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_MESSAGE,
        ) from exc


def _get_cached_jwks() -> dict:
    global _jwks_cache, _jwks_cache_fetched_at
    now = time.monotonic()
    if _jwks_cache is not None and (now - _jwks_cache_fetched_at) < _JWKS_CACHE_TTL_SECONDS:
        return _jwks_cache
    jwks = _fetch_jwks()
    _jwks_cache = jwks
    _jwks_cache_fetched_at = now
    return jwks


def _clear_jwks_cache() -> None:
    """Clear the in-memory JWKS cache. Used in tests."""
    global _jwks_cache, _jwks_cache_fetched_at
    _jwks_cache = None
    _jwks_cache_fetched_at = 0.0


def _public_key_for_kid(kid: str):
    jwks = _get_cached_jwks()
    keys = jwks.get("keys", [])
    for key_dict in keys:
        if key_dict.get("kid") == kid:
            try:
                jwk = jwt.PyJWK(key_dict)
                return jwk.key
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=_INVALID_MESSAGE,
                ) from exc
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=_INVALID_MESSAGE,
    )


def decode_access_token(token: str, secret: str | None = None) -> dict:
    """Verify and decode a Supabase access token.

    Production tokens are ES256 signed with Supabase JWT Signing Keys
    (JWKS). HS256 is only accepted in test/development for locally
    generated tokens.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_MESSAGE,
        )

    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_MESSAGE,
        ) from exc

    alg = header.get("alg")

    # ES256 - production path
    if alg == "ES256":
        kid = header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_INVALID_MESSAGE,
            )
        public_key = _public_key_for_kid(kid)
        try:
            return jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_EXPIRED_MESSAGE,
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_INVALID_MESSAGE,
            ) from exc

    # HS256 - only allowed in non-production environments for tests
    if alg == "HS256":
        from app.core.config import get_settings

        settings = get_settings()
        if settings.app_env.lower() not in {"test", "testing", "development", "dev"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_INVALID_MESSAGE,
            )
        # Use provided secret or fallback to configured secret
        verify_secret = secret if secret is not None else settings.supabase_jwt_secret
        if not verify_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_INVALID_MESSAGE,
            )
        try:
            return jwt.decode(
                token,
                verify_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_EXPIRED_MESSAGE,
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_INVALID_MESSAGE,
            ) from exc

    # Unsupported algorithm
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=_INVALID_MESSAGE,
    )
