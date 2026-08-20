"""Data provider abstraction.

The application talks to Supabase exclusively through this interface so the
FastAPI routes and services stay testable without a live Supabase project
(tests inject an in-memory fake).
"""

from typing import Protocol

from app.schemas.diagnosis import AuthorizedDiagnosis
from app.schemas.domain import Diagnosis, Farm, Invitation, Profile
from app.schemas.farms import FarmDiagnosis
from app.schemas.messages import MessageItem
from app.schemas.statistics import FarmStatistics


class DataProvider(Protocol):
    """Minimal data surface used by the Phase 1 endpoints."""

    def get_profile(self, token: str, user_id: str) -> Profile | None: ...

    def has_pending_invitation(self, token: str) -> bool: ...

    def set_profile_full_name(self, token: str, user_id: str, full_name: str) -> Profile: ...

    def get_farm(self, token: str, farm_id: str) -> Farm | None: ...

    def list_farm_members(self, token: str, farm_id: str) -> list[Profile]: ...

    def complete_admin_onboarding(self, token: str, farm_name: str) -> Farm: ...

    def claim_pending_invitation(self, token: str) -> Profile: ...

    def create_invitation(
        self, token: str, farm_id: str, email: str, invited_name: str | None
    ) -> Invitation: ...

    def delete_invitation(self, invitation_id: str) -> None: ...

    def invite_user_by_email(
        self, email: str, metadata: dict[str, str] | None, redirect_to: str
    ) -> None: ...

    def create_diagnosis(
        self,
        token: str,
        *,
        disease: str,
        confidence: float,
        crop: str,
        model_version: str,
    ) -> Diagnosis: ...

    def list_diagnoses(self, token: str, *, farmer_id: str, limit: int = 20) -> list[Diagnosis]: ...

    def get_diagnosis(self, token: str, *, diagnosis_id: str, farmer_id: str) -> Diagnosis | None: ...

    def get_authorized_diagnosis(
        self, token: str, *, diagnosis_id: str
    ) -> AuthorizedDiagnosis | None: ...

    def get_farm_statistics(self, token: str, farm_id: str) -> FarmStatistics: ...

    def list_farm_diagnoses(
        self, token: str, farm_id: str, *, limit: int = 20, offset: int = 0
    ) -> list[FarmDiagnosis]: ...

    def list_messages(self, token: str, *, user_id: str, limit: int = 100) -> list[MessageItem]: ...

    def create_message(self, token: str, *, recipient_id: str, body: str) -> MessageItem: ...

    def mark_message_read(self, token: str, *, message_id: str) -> MessageItem | None: ...