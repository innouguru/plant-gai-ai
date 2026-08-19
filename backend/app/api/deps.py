"""FastAPI dependencies for authentication and authorization."""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.interface import DataProvider
from app.db.supabase_provider import build_provider
from app.schemas.domain import Profile, Role

_bearer = HTTPBearer(auto_error=False)


def get_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Extract the bearer access token or fail with 401."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    return credentials.credentials


def get_provider() -> DataProvider:
    """Provide a Supabase-backed data provider (overridable in tests)."""
    settings = get_settings()
    if not settings.supabase_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured.",
        )
    return build_provider(
        url=settings.supabase_url,
        anon_key=settings.supabase_anon_key,
        service_role_key=settings.supabase_service_role_key,
    )


@dataclass
class UserContext:
    """Authenticated caller plus their application profile."""

    token: str
    user_id: str
    email: str | None
    profile: Profile


def get_current_user(
    request: Request,
    token: str = Depends(get_access_token),
    provider: DataProvider = Depends(get_provider),
) -> UserContext:
    """Verify the access token and load the caller's profile."""
    cached = getattr(request.state, "user_context", None)
    if cached is not None:
        return cached
    settings = get_settings()
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the server.",
        )

    claims = decode_access_token(token, settings.supabase_jwt_secret)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing access token.",
        )

    profile = provider.get_profile(token, user_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account could not be found.",
        )

    context = UserContext(token=token, user_id=user_id, email=claims.get("email"), profile=profile)
    request.state.user_context = context
    return context


def require_farm_admin(ctx: UserContext = Depends(get_current_user)) -> UserContext:
    """Reject callers that are not farm admins (server-side enforcement)."""
    if ctx.profile.role != Role.farm_admin or ctx.profile.farm_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )
    return ctx


def require_farmer(ctx: UserContext = Depends(get_current_user)) -> UserContext:
    """Reject callers that are not farmers on a farm (server-side enforcement)."""
    if ctx.profile.role != Role.farmer or ctx.profile.farm_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only farmers on a farm can run a diagnosis.",
        )
    return ctx


def get_diagnosis_service():
    """Provide the shared (lazily loaded) inference service; overridable in tests.

    The import stays inside the function so ``torch`` is never loaded merely by
    importing the API application.
    """
    from app.services.ml.inference_service import get_inference_service

    return get_inference_service()