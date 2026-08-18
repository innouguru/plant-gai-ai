"""Authenticated session/profile endpoints."""

from fastapi import APIRouter, Depends

from app.api.deps import UserContext, get_current_user, get_provider
from app.db.interface import DataProvider
from app.schemas.auth import ProfileResponse
from app.services.user_service import to_profile_response

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(get_current_user)])


@router.get("/me", response_model=ProfileResponse)
def read_me(
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> ProfileResponse:
    """Return the current user's profile and farm context."""
    return to_profile_response(provider, ctx.token, ctx.profile)