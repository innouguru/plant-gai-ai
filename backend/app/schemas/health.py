"""Response schemas for the health endpoint."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Payload returned by GET /api/v1/health."""

    status: str
    message: str