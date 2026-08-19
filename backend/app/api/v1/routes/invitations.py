"""Farmer invitation endpoints."""

from fastapi import APIRouter, Depends

from app.api.deps import UserContext, get_current_user, get_provider, require_farm_admin
from app.core.rate_limit import invitation_accept_rate_limit, invitations_rate_limit
from app.db.interface import DataProvider
from app.schemas.invitations import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    InvitationResponse,
    InviteRequest,
)
from app.services.invitation_service import (
    accept_invitation as accept_invitation_flow,
)
from app.services.invitation_service import invite_farmer

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("", response_model=InvitationResponse, status_code=201, dependencies=[Depends(invitations_rate_limit())])
def create_invitation(
    payload: InviteRequest,
    ctx: UserContext = Depends(require_farm_admin),
    provider: DataProvider = Depends(get_provider),
) -> InvitationResponse:
    """Invite a farmer by email to the admin's own farm (admin only)."""
    return invite_farmer(provider, ctx.token, ctx.profile, payload.email, payload.full_name)


@router.post("/accept", response_model=AcceptInvitationResponse, dependencies=[Depends(invitation_accept_rate_limit())])
def accept_invitation(
    payload: AcceptInvitationRequest,
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> AcceptInvitationResponse:
    """Bind the authenticated user to the farm of their pending invitation."""
    return accept_invitation_flow(provider, ctx.token, ctx.profile, payload.full_name)