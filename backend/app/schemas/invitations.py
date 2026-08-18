"""Request/response schemas for farmer invitations."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import ProfileResponse
from app.schemas.domain import InvitationStatus


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=120)


class InvitationResponse(BaseModel):
    id: str
    farm_id: str
    email: EmailStr
    invited_name: str | None = None
    status: InvitationStatus
    created_at: datetime | None = None


class AcceptInvitationRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)


class AcceptInvitationResponse(BaseModel):
    profile: ProfileResponse