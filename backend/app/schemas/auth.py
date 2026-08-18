"""Request/response schemas for authentication-related endpoints."""

from pydantic import BaseModel, EmailStr

from app.schemas.domain import Role
from app.schemas.farms import FarmResponse


class ProfileResponse(BaseModel):
    """The current user's profile plus their farm context."""

    id: str
    email: EmailStr
    full_name: str | None = None
    role: Role
    farm_id: str | None = None
    farm: FarmResponse | None = None
    requires_onboarding: bool = False