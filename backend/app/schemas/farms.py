"""Request/response schemas for farm endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.domain import Role


class FarmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    admin_id: str
    created_at: datetime | None = None


class FarmMember(BaseModel):
    """A farmer profile belonging to a farm."""

    id: str
    email: EmailStr
    full_name: str | None = None
    role: Role