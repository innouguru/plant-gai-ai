"""Farmer invitation domain logic."""

from fastapi import HTTPException

from app.core.config import get_settings
from app.db.errors import ProviderError
from app.db.interface import DataProvider
from app.schemas.domain import Profile
from app.schemas.invitations import (
    AcceptInvitationResponse,
    InvitationResponse,
)
from app.services.user_service import require_farm_admin, to_profile_response


def invite_farmer(
    provider: DataProvider,
    token: str,
    profile: Profile,
    email: str,
    invited_name: str | None,
) -> InvitationResponse:
    """Record an invitation for the admin's farm and email it to the farmer."""
    require_farm_admin(profile)
    farm_id = profile.farm_id if profile.farm_id is not None else ""

    invitation = provider.create_invitation(token, farm_id, email, invited_name)

    redirect_to = get_settings().frontend_origin + "/complete-registration"
    try:
        provider.invite_user_by_email(
            email,
            {"invited_name": invited_name or "", "farm_id": farm_id},
            redirect_to,
        )
    except ProviderError:
        provider.delete_invitation(invitation.id)
        raise HTTPException(
            status_code=400,
            detail="We could not send this invitation. The email may already be registered.",
        ) from None

    return invitation


def accept_invitation(
    provider: DataProvider,
    token: str,
    profile: Profile,
    full_name: str,
) -> AcceptInvitationResponse:
    """Bind the invited farmer to the farm named in their invitation."""
    if profile.farm_id is not None:
        raise HTTPException(
            status_code=409,
            detail="This account is already associated with a farm.",
        )

    provider.set_profile_full_name(token, profile.id, full_name)
    claimed = provider.claim_pending_invitation(token)
    return AcceptInvitationResponse(profile=to_profile_response(provider, token, claimed))