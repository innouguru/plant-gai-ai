"""Supabase-backed data provider.

Talks to Supabase through its public REST endpoints:

- PostgREST (``/rest/v1``) for table reads/writes and RPC calls, using the
  caller's access token so Row Level Security is applied.
- Auth Admin (``/auth/v1/admin``) for server-side invites, using the
  service-role key (never exposed to the frontend).
"""

from typing import Any

import httpx

from app.db.errors import ProviderError
from app.db.interface import DataProvider
from app.schemas.diagnosis import AuthorizedDiagnosis
from app.schemas.domain import Diagnosis, Farm, Invitation, InvitationStatus, Profile, Role
from app.schemas.farms import FarmDiagnosis
from app.schemas.messages import MessageItem
from app.schemas.statistics import FarmStatistics

_TIMEOUT = httpx.Timeout(15.0)


class SupabaseDataProvider:
    """Real data provider backed by a Supabase project."""

    def __init__(self, url: str, anon_key: str, service_role_key: str) -> None:
        self._url = url.rstrip("/")
        self._anon_key = anon_key
        self._service_role_key = service_role_key
        self._client = httpx.Client(timeout=_TIMEOUT)

    def close(self) -> None:
        self._client.close()

    # ------------------------------------------------------------------
    # header helpers
    # ------------------------------------------------------------------

    def _user_headers(self, token: str) -> dict[str, str]:
        return {"apikey": self._anon_key, "Authorization": f"Bearer {token}"}

    def _service_headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    # ------------------------------------------------------------------
    # profiles
    # ------------------------------------------------------------------

    def get_profile(self, token: str, user_id: str) -> Profile | None:
        response = self._client.get(
            f"{self._url}/rest/v1/profiles",
            params={"select": "id,email,full_name,role,farm_id,created_at", "id": f"eq.{user_id}"},
            headers=self._user_headers(token),
        )
        self._raise_for_status(response)
        rows = response.json()
        if not rows:
            return None
        return Profile.model_validate(rows[0])

    def has_pending_invitation(self, token: str) -> bool:
        """True when the caller has an unclaimed invitation.

        Uses the caller's own access token so the "read own invitation" RLS
        policy limits the result to the caller's own pending invitations.
        """
        response = self._client.get(
            f"{self._url}/rest/v1/invitations",
            params={"select": "id", "status": "eq.pending", "limit": 1},
            headers=self._user_headers(token),
        )
        self._raise_for_status(response)
        return bool(response.json())

    def set_profile_full_name(self, token: str, user_id: str, full_name: str) -> Profile:
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/update_profile_full_name",
            headers=self._user_headers(token),
            json={"p_full_name": full_name},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None or row.get("id") != user_id:
            raise ProviderError("profile_update_failed", "Could not update your profile.")
        return Profile.model_validate(row)

    # ------------------------------------------------------------------
    # farms
    # ------------------------------------------------------------------

    def get_farm(self, token: str, farm_id: str) -> Farm | None:
        response = self._client.get(
            f"{self._url}/rest/v1/farms",
            params={"select": "id,name,admin_id,created_at", "id": f"eq.{farm_id}"},
            headers=self._user_headers(token),
        )
        self._raise_for_status(response)
        rows = response.json()
        if not rows:
            return None
        return Farm.model_validate(rows[0])

    def list_farm_members(self, token: str, farm_id: str) -> list[Profile]:
        response = self._client.get(
            f"{self._url}/rest/v1/profiles",
            params={
                "select": "id,email,full_name,role,created_at",
                "farm_id": f"eq.{farm_id}",
                "order": "created_at.asc",
            },
            headers=self._user_headers(token),
        )
        self._raise_for_status(response)
        return [Profile.model_validate(row) for row in response.json()]

    # ------------------------------------------------------------------
    # RPCs (SECURITY DEFINER, re-check auth.uid() internally)
    # ------------------------------------------------------------------

    def complete_admin_onboarding(self, token: str, farm_name: str) -> Farm:
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/complete_admin_onboarding",
            headers=self._user_headers(token),
            json={"new_farm_name": farm_name},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None:
            raise ProviderError("onboarding_failed", "Could not create your farm.")
        return Farm.model_validate(row)

    def claim_pending_invitation(self, token: str) -> Profile:
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/claim_pending_invitation",
            headers=self._user_headers(token),
            json={},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None:
            raise ProviderError("claim_failed", "Could not claim your invitation.")
        return Profile.model_validate(row)

    # ------------------------------------------------------------------
    # invitations
    # ------------------------------------------------------------------

    def create_invitation(
        self, token: str, farm_id: str, email: str, invited_name: str | None
    ) -> Invitation:
        response = self._client.post(
            f"{self._url}/rest/v1/invitations",
            headers={**self._user_headers(token), "Prefer": "return=representation"},
            json={
                "farm_id": farm_id,
                "email": email,
                "invited_name": invited_name,
                "status": InvitationStatus.pending.value,
            },
        )
        self._raise_for_status(response)
        rows = response.json()
        if not rows:
            raise ProviderError("invite_insert_failed", "Could not record the invitation.")
        return Invitation.model_validate(rows[0])

    def delete_invitation(self, invitation_id: str) -> None:
        response = self._client.delete(
            f"{self._url}/rest/v1/invitations",
            params={"id": f"eq.{invitation_id}"},
            headers=self._service_headers(),
        )
        self._raise_for_status(response)

    def invite_user_by_email(
        self, email: str, metadata: dict[str, str] | None, redirect_to: str
    ) -> None:
        response = self._client.post(
            f"{self._url}/auth/v1/invite",
            headers=self._service_headers(),
            json={"email": email, "data": metadata or {}},
            params={"redirect_to": redirect_to} if redirect_to else None,
        )
        self._raise_for_status(response)

    # ------------------------------------------------------------------
    # diagnoses (append-only; caller identity derived from the JWT)
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
        """Persist a diagnosis for the authenticated user and their farm.

        farmer_id/farm_id are derived inside ``save_diagnosis`` (SECURITY
        DEFINER) from the caller's JWT/profile — never accepted from the client.
        """
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/save_diagnosis",
            headers=self._user_headers(token),
            json={
                "p_disease": disease,
                "p_confidence": confidence,
                "p_crop": crop,
                "p_model_version": model_version,
            },
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None:
            raise ProviderError("diagnosis_save_failed", "Could not save the diagnosis.")
        return AuthorizedDiagnosis.model_validate(row)

    def list_diagnoses(self, token: str, *, farmer_id: str, limit: int = 20) -> list[Diagnosis]:
        """Return the caller's own diagnoses, newest first.

        The ``farmer_id`` filter is supplied by the server (the authenticated
        user) and the "select own diagnosis" RLS policy also constrains rows to
        the caller.
        """
        response = self._client.get(
            f"{self._url}/rest/v1/diagnoses",
            params={
                "select": "id,farmer_id,farm_id,disease,confidence,crop,model_version,created_at",
                "farmer_id": f"eq.{farmer_id}",
                "order": "created_at.desc",
                "limit": limit,
            },
            headers=self._user_headers(token),
        )
        self._raise_for_status(response)
        return [Diagnosis.model_validate(row) for row in response.json()]

    def get_diagnosis(self, token: str, *, diagnosis_id: str, farmer_id: str) -> Diagnosis | None:
        """Return a single diagnosis only if it belongs to the caller."""
        response = self._client.get(
            f"{self._url}/rest/v1/diagnoses",
            params={
                "select": "id,farmer_id,farm_id,disease,confidence,crop,model_version,created_at",
                "id": f"eq.{diagnosis_id}",
                "farmer_id": f"eq.{farmer_id}",
                "limit": 1,
            },
            headers=self._user_headers(token),
        )
        self._raise_for_status(response)
        rows = response.json()
        if not rows:
            return None
        return Diagnosis.model_validate(rows[0])

    def get_authorized_diagnosis(
        self, token: str, *, diagnosis_id: str
    ) -> AuthorizedDiagnosis | None:
        """Return a diagnosis allowed by the caller's role and farm RLS."""
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/get_authorized_diagnosis",
            headers=self._user_headers(token),
            json={"p_diagnosis_id": diagnosis_id},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None:
            return None
        return AuthorizedDiagnosis.model_validate(row)

    def get_farm_statistics(self, token: str, farm_id: str) -> FarmStatistics:
        """Return statistics through the authorization-checking RPC."""
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/get_farm_statistics",
            headers=self._user_headers(token),
            json={"p_farm_id": farm_id},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None:
            raise ProviderError("farm_statistics_failed", "Could not load farm statistics.")
        return FarmStatistics.model_validate(row)

    def list_farm_diagnoses(
        self, token: str, farm_id: str, *, limit: int = 20, offset: int = 0
    ) -> list[FarmDiagnosis]:
        """Return one authorized farm's diagnoses, newest first."""
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/list_farm_diagnoses",
            headers=self._user_headers(token),
            json={"p_farm_id": farm_id, "p_limit": limit, "p_offset": offset},
        )
        self._raise_for_status(response)
        return [FarmDiagnosis.model_validate(row) for row in response.json()]

    def list_messages(self, token: str, *, user_id: str, limit: int = 100) -> list[MessageItem]:
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/list_messages",
            headers=self._user_headers(token),
            json={"p_limit": limit},
        )
        self._raise_for_status(response)
        return [MessageItem.model_validate(row) for row in response.json()]

    def create_message(self, token: str, *, recipient_id: str, body: str) -> MessageItem:
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/send_message",
            headers=self._user_headers(token),
            json={"p_recipient_id": recipient_id, "p_body": body},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        if row is None:
            raise ProviderError("message_send_failed", "Could not send the message.")
        return MessageItem.model_validate(row)

    def mark_message_read(self, token: str, *, message_id: str) -> MessageItem | None:
        response = self._client.post(
            f"{self._url}/rest/v1/rpc/mark_message_read",
            headers=self._user_headers(token),
            json={"p_message_id": message_id},
        )
        self._raise_for_status(response)
        row = self._first_row(response.json())
        return MessageItem.model_validate(row) if row else None

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _first_row(data: Any) -> dict | None:
        if isinstance(data, list):
            return data[0] if data else None
        if isinstance(data, dict):
            return data
        return None

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code < 300:
            return
        code = "request_failed"
        message = ""
        try:
            payload = response.json()
            code = str(payload.get("code", code))
            message = str(payload.get("message", ""))
        except ValueError:
            pass
        raise ProviderError(
            code,
            message or f"Supabase request failed with status {response.status_code}.",
            supabase_status=response.status_code,
        )


def build_provider(url: str, anon_key: str, service_role_key: str) -> SupabaseDataProvider:
    """Build a Supabase data provider (interface-compatible with ``DataProvider``)."""
    return SupabaseDataProvider(url=url, anon_key=anon_key, service_role_key=service_role_key)


# Re-export the Protocol so callers can annotate against the interface.
__all__ = ["DataProvider", "SupabaseDataProvider", "build_provider"]