"""Farm-scoped messaging endpoints."""

from fastapi import APIRouter, Depends, status

from app.api.deps import UserContext, get_current_user, get_provider
from app.core.rate_limit import authenticated_read_rate_limit, messages_write_rate_limit
from app.db.interface import DataProvider
from app.schemas.messages import MessageCreate, MessageItem
from app.services.messaging_service import list_messages, mark_message_read, send_message

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("", response_model=list[MessageItem], dependencies=[Depends(authenticated_read_rate_limit("messages_reads"))])
def get_messages(
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> list[MessageItem]:
    return list_messages(provider, ctx.token, ctx.profile)


@router.post("", response_model=MessageItem, status_code=status.HTTP_201_CREATED, dependencies=[Depends(messages_write_rate_limit())])
def post_message(
    payload: MessageCreate,
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> MessageItem:
    return send_message(provider, ctx.token, ctx.profile, payload.recipient_id, payload.body)


@router.patch("/{message_id}/read", response_model=MessageItem, dependencies=[Depends(authenticated_read_rate_limit("messages_reads"))])
def read_message(
    message_id: str,
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> MessageItem:
    return mark_message_read(provider, ctx.token, ctx.profile, message_id)