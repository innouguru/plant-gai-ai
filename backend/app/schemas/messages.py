"""API schemas for farm-scoped messaging."""

from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    """Client input for sending a message; sender and farm are server-derived."""

    recipient_id: str
    body: str = Field(..., min_length=1, max_length=2000)


class MessageItem(BaseModel):
    """A message visible to one participant."""

    id: str
    sender_id: str
    sender_name: str | None = None
    recipient_id: str
    recipient_name: str | None = None
    body: str
    read_at: datetime | None = None
    created_at: datetime