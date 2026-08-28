"""Farmer invitation domain logic."""

import logging

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

logger = logging.getLogger("app.observability")


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
        try:
            provider.delete_invitation(invitation.id)
        except ProviderError as rollback_err:
            logger.warning(
                f"invitation_rollback_failed error_code={rollback_err.code} supabase_status={getattr(rollback_err, 'supabase_status', 'unknown')}",
                extra={
                    "error_code": rollback_err.code,
                    "supabase_status": getattr(rollback_err, "supabase_status", None),
                    "event_type": "invitation_rollback_failed",
                },
            )
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