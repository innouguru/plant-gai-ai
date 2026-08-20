"""Farm domain logic: admin onboarding and farm-boundary access."""

from fastapi import HTTPException

from app.db.interface import DataProvider
from app.schemas.domain import Farm, Profile
from app.schemas.farms import FarmDiagnosis, FarmMember
from app.schemas.statistics import FarmStatistics
from app.schemas.onboarding import OnboardingResponse
from app.services.user_service import require_farm_admin, to_profile_response


def complete_onboarding(
    provider: DataProvider,
    token: str,
    profile: Profile,
    farm_name: str,
) -> OnboardingResponse:
    """Create a farm and promote the caller to its farm_admin."""
    if profile.farm_id is not None or profile.role.value == "farm_admin":
        raise HTTPException(status_code=409, detail="This account has already been set up.")

    # Mirrors complete_admin_onboarding(): a user with an unclaimed invitation
    # must accept it instead of creating their own farm.
    if provider.has_pending_invitation(token):
        raise HTTPException(
            status_code=409,
            detail="You have a pending invitation. Accept it before setting up a new farm.",
        )

    farm = provider.complete_admin_onboarding(token, farm_name)

    refreshed = provider.get_profile(token, profile.id)
    if refreshed is None:
        raise HTTPException(status_code=401, detail="Your account could not be found.")
    return OnboardingResponse(profile=to_profile_response(provider, token, refreshed), farm=farm)


def get_farm(provider: DataProvider, token: str, profile: Profile, farm_id: str) -> Farm:
    """Return a farm only if the caller belongs to it."""
    if profile.farm_id != farm_id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this farm.")
    farm = provider.get_farm(token, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found.")
    return farm


def list_farm_members(
    provider: DataProvider,
    token: str,
    profile: Profile,
    farm_id: str,
) -> list[FarmMember]:
    """List farmers of a farm; farm admins of that farm only."""
    require_farm_admin(profile)
    if profile.farm_id != farm_id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this farm.")

    members = provider.list_farm_members(token, farm_id)
    return [
        FarmMember(id=member.id, email=member.email, full_name=member.full_name, role=member.role)
        for member in members
    ]


def get_farm_statistics(
    provider: DataProvider,
    token: str,
    profile: Profile,
    farm_id: str,
) -> FarmStatistics:
    """Return statistics only for the authenticated admin's own farm."""
    require_farm_admin(profile)
    if profile.farm_id != farm_id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this farm.")
    return provider.get_farm_statistics(token, farm_id)


def list_farm_diagnoses(
    provider: DataProvider,
    token: str,
    profile: Profile,
    farm_id: str,
    *,
    limit: int,
    offset: int,
) -> list[FarmDiagnosis]:
    """Return paginated diagnoses only for the admin's own farm."""
    require_farm_admin(profile)
    if profile.farm_id != farm_id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this farm.")
    return provider.list_farm_diagnoses(token, farm_id, limit=limit, offset=offset)