"""HTTP mapping for provider-level errors."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.db.errors import ProviderError

_STATUS_BY_CODE: dict[str, tuple[int, str]] = {
    "not_authenticated": (401, "Not authenticated."),
    "profile_not_found": (401, "Your account could not be found."),
    "already_onboarded": (409, "This account has already been set up."),
    "onboarding_failed": (400, "Could not create your farm."),
    "no_pending_invitation": (400, "No invitation was found for this account."),
    "claim_failed": (400, "Could not claim your invitation."),
    "invite_insert_failed": (400, "Could not record the invitation."),
    "invite_exists": (400, "This email is already registered. Farmers are added through an invitation email."),
    "profile_update_failed": (400, "Could not update your profile."),
    "diagnosis_save_failed": (400, "We could not save your diagnosis. Please try again."),
    "diagnosis_forbidden": (403, "Only farmers on a farm can run a diagnosis."),
}

_BACKEND_DEFAULT = "An external service error occurred. Please try again."


def provider_error_to_response(request: Request, exc: ProviderError) -> JSONResponse:
    """Global handler that converts provider errors into safe user messages."""
    status_code, detail = _STATUS_BY_CODE.get(exc.code, (502, _BACKEND_DEFAULT))
    return JSONResponse(status_code=status_code, content={"detail": detail})