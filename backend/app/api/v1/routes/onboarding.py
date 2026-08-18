"""Admin onboarding endpoint (create account's first farm)."""

from fastapi import APIRouter, Depends

from app.api.deps import UserContext, get_current_user, get_provider
from app.db.interface import DataProvider
from app.schemas.onboarding import OnboardingRequest, OnboardingResponse
from app.services.farm_service import complete_onboarding

router = APIRouter(tags=["onboarding"])


@router.post("/onboarding", response_model=OnboardingResponse, status_code=201)
def create_farm(
    payload: OnboardingRequest,
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> OnboardingResponse:
    """Create a farm and make the current user its farm_admin."""
    return complete_onboarding(provider, ctx.token, ctx.profile, payload.farm_name)