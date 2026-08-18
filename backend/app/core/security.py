"""JWT verification for Supabase Auth access tokens.

The backend never issues its own tokens. It validates the access tokens
issued by Supabase Auth (HS256, signed with the project JWT secret) and
derives the application role from the user's profile row in the database.
"""

import time
import uuid

import jwt
from fastapi import HTTPException, status

_EXPIRED_MESSAGE = "Your session has expired. Please log in again."
_INVALID_MESSAGE = "Invalid or missing access token."


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
    tokens to end users.
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


def decode_access_token(token: str, secret: str) -> dict:
    """Verify and decode a Supabase access token."""
    try:
        return jwt.decode(
            token,
            secret,
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