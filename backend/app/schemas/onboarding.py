"""Request/response schemas for admin onboarding."""

from pydantic import BaseModel, Field

from app.schemas.auth import ProfileResponse
from app.schemas.farms import FarmResponse


class OnboardingRequest(BaseModel):
    farm_name: str = Field(min_length=2, max_length=120)


class OnboardingResponse(BaseModel):
    profile: ProfileResponse
    farm: FarmResponse