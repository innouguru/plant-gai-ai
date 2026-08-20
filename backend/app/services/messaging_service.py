"""Farm-scoped messaging domain logic."""

from fastapi import HTTPException

from app.db.interface import DataProvider
from app.schemas.domain import Profile
from app.schemas.messages import MessageItem


def list_messages(provider: DataProvider, token: str, profile: Profile) -> list[MessageItem]:
    if profile.farm_id is None:
        raise HTTPException(status_code=403, detail="You must belong to a farm to use messaging.")
    return provider.list_messages(token, user_id=profile.id)


def send_message(
    provider: DataProvider, token: str, profile: Profile, recipient_id: str, body: str
) -> MessageItem:
    if profile.farm_id is None:
        raise HTTPException(status_code=403, detail="You must belong to a farm to use messaging.")
    return provider.create_message(token, recipient_id=recipient_id, body=body)


def mark_message_read(
    provider: DataProvider, token: str, profile: Profile, message_id: str
) -> MessageItem:
    if profile.farm_id is None:
        raise HTTPException(status_code=403, detail="You must belong to a farm to use messaging." )
    message = provider.mark_message_read(token, message_id=message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="That message could not be found.")
    return message