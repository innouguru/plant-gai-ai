"""Shared domain models (also used as database row representations)."""

import enum
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Role(str, enum.Enum):
    farmer = "farmer"
    farm_admin = "farm_admin"


class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"


class Profile(BaseModel):
    """Application profile row backed by a Supabase Auth user."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str | None = None
    role: Role
    farm_id: str | None = None
    created_at: datetime | None = None


class Farm(BaseModel):
    """A farm: the primary organizational boundary."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    admin_id: str
    created_at: datetime | None = None


class Invitation(BaseModel):
    """A farmer invitation tied to the admin's farm."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    email: str
    invited_name: str | None = None
    status: InvitationStatus
    created_at: datetime | None = None