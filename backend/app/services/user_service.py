"""User/profile service helpers shared across routes."""

from fastapi import HTTPException

from app.db.interface import DataProvider
from app.schemas.auth import ProfileResponse
from app.schemas.domain import Profile, Role
from app.schemas.farms import FarmResponse


def require_farm_admin(profile: Profile) -> None:
    """Raise 403/409 unless the profile is a farm admin with a farm."""
    if profile.role != Role.farm_admin:
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    if profile.farm_id is None:
        raise HTTPException(status_code=409, detail="Set up your farm before using this feature.")


def to_profile_response(provider: DataProvider, token: str, profile: Profile) -> ProfileResponse:
    """Build the /auth/me payload, attaching the farm context when present."""
    farm: FarmResponse | None = None
    if profile.farm_id is not None:
        farm_row = provider.get_farm(token, profile.farm_id)
        if farm_row is not None:
            farm = FarmResponse.model_validate(farm_row)
    return ProfileResponse(
        id=profile.id,
        email=profile.email,
        full_name=profile.full_name,
        role=profile.role,
        farm_id=profile.farm_id,
        farm=farm,
        requires_onboarding=profile.farm_id is None,
    )