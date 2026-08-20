"""Request/response schemas for farm endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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


class FarmDiagnosis(BaseModel):
    """A diagnosis row with the farmer's safe display name."""

    id: str
    farmer_id: str
    farmer_name: str | None = None
    disease: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    crop: str
    model_version: str
    created_at: datetime