"""In-memory fake data provider for backend tests (no Supabase required)."""

import itertools
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.security import decode_access_token
from app.db.errors import ProviderError
from app.schemas.domain import (
    Diagnosis,
    Farm,
    Invitation,
    InvitationStatus,
    Profile,
    Role,
)


def _now() -> datetime:
    return datetime(2026, 1, 1, tzinfo=timezone.utc)


class FakeDataProvider:
    """Implements the DataProvider protocol with in-process state."""

    def __init__(self) -> None:
        self.profiles: dict[str, Profile] = {}
        self.farms: dict[str, Farm] = {}
        self.invitations: dict[str, Invitation] = {}
        self.diagnoses: dict[str, Diagnosis] = {}
        self.invite_calls: list[dict] = []
        self.fail_invite_emails: set[str] = set()
        self._seq = itertools.count(1)

    # ------------------------------------------------------------------
    # seeding helpers
    # ------------------------------------------------------------------

    def new_id(self, prefix: str = "") -> str:
        return f"{prefix}{next(self._seq)}"

    def seed_user(
        self,
        *,
        email: str,
        full_name: str | None,
        role: Role,
        farm_id: str | None = None,
    ) -> Profile:
        profile = Profile(
            id=str(uuid.uuid4()),
            email=email,
            full_name=full_name,
            role=role,
            farm_id=farm_id,
            created_at=_now(),
        )
        self.profiles[profile.id] = profile
        return profile

    def seed_admin(self, *, email: str = "admin@example.com", farm_id: str) -> Profile:
        return self.seed_user(email=email, full_name="Farm Admin", role=Role.farm_admin, farm_id=farm_id)

    def seed_farmer(self, *, email: str, farm_id: str | None = None) -> Profile:
        return self.seed_user(email=email, full_name="A Farmer", role=Role.farmer, farm_id=farm_id)

    def seed_farm(self, *, name: str, admin_id: str) -> Farm:
        farm = Farm(id=self.new_id("farm-"), name=name, admin_id=admin_id, created_at=_now())
        self.farms[farm.id] = farm
        return farm

    def seed_invitation(self, *, farm_id: str, email: str, invited_name: str = "New Farmer") -> Invitation:
        inv = Invitation(
            id=self.new_id("inv-"),
            farm_id=farm_id,
            email=email,
            invited_name=invited_name,
            status=InvitationStatus.pending,
            created_at=_now(),
        )
        self.invitations[inv.id] = inv
        return inv

    def seed_diagnosis(
        self,
        *,
        farmer_id: str,
        farm_id: str,
        disease: str = "Cassava mosaic",
        confidence: float = 0.9,
        crop: str = "Cassava",
        model_version: str = "1.0.0",
        created_at: datetime | None = None,
    ) -> Diagnosis:
        diagnosis = Diagnosis(
            id=self.new_id("diag-"),
            farmer_id=farmer_id,
            farm_id=farm_id,
            disease=disease,
            confidence=confidence,
            crop=crop,
            model_version=model_version,
            created_at=created_at or _now(),
        )
        self.diagnoses[diagnosis.id] = diagnosis
        return diagnosis

    # ------------------------------------------------------------------
    # diagnoses (parity with the Supabase SECURITY DEFINER + RLS behavior)
    # ------------------------------------------------------------------

    def create_diagnosis(
        self,
        token: str,
        *,
        disease: str,
        confidence: float,
        crop: str,
        model_version: str,
    ) -> Diagnosis:
        """Persist a diagnosis deriving farmer_id/farm_id from the token/profile."""
        user_id = self._user_id_from_token(token)
        profile = self.profiles.get(user_id)
        if profile is None:
            raise ProviderError("not_authenticated", "profile not found")
        if profile.role != Role.farmer or profile.farm_id is None:
            raise ProviderError("diagnosis_forbidden", "not an eligible farmer")

        diagnosis = Diagnosis(
            id=self.new_id("diag-"),
            farmer_id=user_id,
            farm_id=profile.farm_id,
            disease=disease,
            confidence=confidence,
            crop=crop,
            model_version=model_version,
            created_at=_now(),
        )
        self.diagnoses[diagnosis.id] = diagnosis
        return diagnosis

    def list_diagnoses(self, token: str, *, farmer_id: str, limit: int = 20) -> list[Diagnosis]:
        """Return the farmer's own diagnoses, newest first (RLS parity)."""
        rows = [d for d in self.diagnoses.values() if d.farmer_id == farmer_id]
        rows.sort(key=lambda d: d.created_at or _now(), reverse=True)
        return rows[:limit]

    def get_diagnosis(self, token: str, *, diagnosis_id: str, farmer_id: str) -> Diagnosis | None:
        """Return a diagnosis only if it belongs to the farmer (RLS parity)."""
        diagnosis = self.diagnoses.get(diagnosis_id)
        if diagnosis is None or diagnosis.farmer_id != farmer_id:
            return None
        return diagnosis

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _user_id_from_token(self, token: str) -> str:
        try:
            claims = decode_access_token(token, _JWT_SECRET())
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else "invalid token"
            raise ProviderError("not_authenticated", detail) from exc
        sub = claims.get("sub")
        if not sub:
            raise ProviderError("not_authenticated", "missing sub claim")
        return sub

    # ------------------------------------------------------------------
    # DataProvider implementation
    # ------------------------------------------------------------------

    def get_profile(self, token: str, user_id: str) -> Profile | None:
        return self.profiles.get(user_id)

    def has_pending_invitation(self, token: str) -> bool:
        user_id = self._user_id_from_token(token)
        profile = self.profiles.get(user_id)
        if profile is None:
            return False
        email = (profile.email or "").lower()
        return any(
            inv.status == InvitationStatus.pending and inv.email.lower() == email
            for inv in self.invitations.values()
        )

    def set_profile_full_name(self, token: str, user_id: str, full_name: str) -> Profile:
        profile = self.profiles.get(user_id)
        if profile is None:
            raise ProviderError("profile_not_found", "profile not found")
        updated = profile.model_copy(update={"full_name": full_name})
        self.profiles[user_id] = updated
        return updated

    def get_farm(self, token: str, farm_id: str) -> Farm | None:
        return self.farms.get(farm_id)

    def list_farm_members(self, token: str, farm_id: str) -> list[Profile]:
        return [p for p in self.profiles.values() if p.farm_id == farm_id]

    def complete_admin_onboarding(self, token: str, farm_name: str) -> Farm:
        user_id = self._user_id_from_token(token)
        profile = self.profiles.get(user_id)
        if profile is None:
            raise ProviderError("profile_not_found", "profile not found")
        if profile.farm_id is not None:
            raise ProviderError("already_onboarded", "profile already onboarded")

        farm = Farm(id=self.new_id("farm-"), name=farm_name, admin_id=user_id, created_at=_now())
        self.farms[farm.id] = farm

        promoted = profile.model_copy(update={"role": Role.farm_admin, "farm_id": farm.id})
        self.profiles[user_id] = promoted
        return farm

    def claim_pending_invitation(self, token: str) -> Profile:
        user_id = self._user_id_from_token(token)
        profile = self.profiles.get(user_id)
        if profile is None:
            raise ProviderError("profile_not_found", "profile not found")

        pending = [
            inv
            for inv in self.invitations.values()
            if inv.status == InvitationStatus.pending and inv.email.lower() == (profile.email or "").lower()
        ]
        if not pending:
            raise ProviderError("no_pending_invitation", "no pending invitation")
        invitation = sorted(pending, key=lambda inv: inv.created_at or _now())[0]

        accepted = invitation.model_copy(update={"status": InvitationStatus.accepted})
        self.invitations[invitation.id] = accepted

        claimed = profile.model_copy(update={"role": Role.farmer, "farm_id": invitation.farm_id})
        self.profiles[user_id] = claimed
        return claimed

    def create_invitation(
        self, token: str, farm_id: str, email: str, invited_name: str | None
    ) -> Invitation:
        user_id = self._user_id_from_token(token)
        profile = self.profiles.get(user_id)
        if profile is None:
            raise ProviderError("not_authenticated", "profile not found")
        if profile.role != Role.farm_admin or profile.farm_id != farm_id:
            raise ProviderError("permission_denied", "RLS rejected invitation insert")

        invitation = Invitation(
            id=self.new_id("inv-"),
            farm_id=farm_id,
            email=email,
            invited_name=invited_name,
            status=InvitationStatus.pending,
            created_at=_now(),
        )
        self.invitations[invitation.id] = invitation
        return invitation

    def delete_invitation(self, invitation_id: str) -> None:
        self.invitations.pop(invitation_id, None)

    def invite_user_by_email(
        self, email: str, metadata: dict[str, str] | None, redirect_to: str
    ) -> None:
        self.invite_calls.append({"email": email, "metadata": metadata, "redirect_to": redirect_to})
        if email in self.fail_invite_emails:
            raise ProviderError("invite_exists", "user already registered")


def _JWT_SECRET() -> str:
    # Mirrors the secret set in tests/conftest.py.
    import os

    return os.environ.get("SUPABASE_JWT_SECRET", "test-jwt-secret")