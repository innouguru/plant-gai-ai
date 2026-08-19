"""HTTP mapping for provider-level errors."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.observability import log_provider_error
from app.core.rate_limit import RateLimitExceeded, RateLimitUnavailable
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
    "farm_stats_forbidden": (403, "You do not have permission to view this farm."),
    "farm_statistics_failed": (502, "Could not load farm statistics."),
    "message_send_failed": (400, "Could not send the message."),
    "message_forbidden": (403, "You do not have permission to use messaging with this user."),
    "message_not_found": (404, "That message could not be found."),
}

_BACKEND_DEFAULT = "An external service error occurred. Please try again."


def provider_error_to_response(request: Request, exc: ProviderError) -> JSONResponse:
    """Global handler that converts provider errors into safe user messages."""
    log_provider_error(request, exc.code)
    status_code, detail = _STATUS_BY_CODE.get(exc.code, (502, _BACKEND_DEFAULT))
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
        headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
    )


def rate_limit_exceeded_to_response(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
        headers={
            "Retry-After": str(exc.retry_after),
            "X-Request-ID": getattr(request.state, "request_id", "unknown"),
        },
    )


def rate_limit_unavailable_to_response(request: Request, exc: RateLimitUnavailable) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "Rate limiting is temporarily unavailable. Please try again."},
        headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
    )