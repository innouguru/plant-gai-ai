"""Small, safe request and exception observability helpers."""

import logging
import re
import time
import traceback
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("app.observability")
REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def get_safe_request_id(value: str | None) -> str:
    """Keep short, simple correlation IDs; replace everything else."""
    if value and len(value) <= MAX_REQUEST_ID_LENGTH and _SAFE_REQUEST_ID.fullmatch(value):
        return value
    return str(uuid4())


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """Attach a request ID and log one sanitized record for every request."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = get_safe_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            raise
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            status_code = getattr(locals().get("response"), "status_code", 500)
            logger.info(
                "request_completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
            )

        response.headers[REQUEST_ID_HEADER] = request_id
        return response


def get_request_id(request: Request) -> str:
    """Return the middleware-assigned request ID for related log records."""
    return getattr(request.state, "request_id", "unknown")


def record_error_event(
    request: Request,
    event_type: str,
    *,
    status_code: int,
    level: int = logging.ERROR,
    error_code: str | None = None,
    exception_type: str | None = None,
    traceback_locations: str | None = None,
) -> None:
    """Record a structured error event without exception text or request data."""
    extra = {
        "request_id": get_request_id(request),
        "method": request.method,
        "path": request.url.path,
        "status_code": status_code,
        "event_type": event_type,
    }
    if error_code is not None:
        extra["error_code"] = error_code
    if exception_type is not None:
        extra["exception_type"] = exception_type
    if traceback_locations is not None:
        extra["traceback_locations"] = traceback_locations
    logger.log(level, event_type, extra=extra)


def log_provider_error(request: Request, code: str, status_code: int) -> None:
    """Log only a safe provider error code and request context."""
    record_error_event(
        request,
        "provider_error",
        status_code=status_code,
        level=logging.WARNING,
        error_code=code,
    )


def unexpected_error_to_response(request: Request, exc: Exception) -> JSONResponse:
    """Log an unexpected exception while returning a generic client response."""
    traceback_locations = "\n".join(
        f'File "{frame.filename}", line {frame.lineno}, in {frame.name}'
        for frame in traceback.extract_tb(exc.__traceback__)
    )
    record_error_event(
        request,
        "unexpected_error",
        status_code=500,
        exception_type=type(exc).__name__,
        traceback_locations=traceback_locations,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
        headers={REQUEST_ID_HEADER: get_request_id(request)},
    )
