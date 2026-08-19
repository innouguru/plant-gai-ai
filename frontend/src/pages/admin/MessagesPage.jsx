import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchMessages, markMessageRead, sendMessage } from "../../api/messages";
import PageHeader from "../../components/ui/PageHeader";
import Avatar from "../../components/ui/Avatar";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { devConversations, devConversationById } from "../../data/devMocks";

function formatMessageTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function buildConversations(messages, currentUserId) {
  const grouped = new Map();

  messages.forEach((message) => {
    const isOutgoing = message.sender_id === currentUserId;
    const participantId = isOutgoing ? message.recipient_id : message.sender_id;
    const participantName = isOutgoing
      ? message.recipient_name ?? "Farmer"
      : message.sender_name ?? "Farmer";
    const conversation = grouped.get(participantId) ?? {
      id: participantId,
      farmerName: participantName,
      messages: [],
      latestAt: message.created_at,
      unread: false,
    };

    conversation.messages.push({
      id: message.id,
      from: isOutgoing ? "admin" : "farmer",
      text: message.body,
      time: formatMessageTime(message.created_at),
      readAt: message.read_at,
      createdAt: message.created_at,
    });
    conversation.latestAt = conversation.latestAt > message.created_at
      ? conversation.latestAt
      : message.created_at;
    conversation.unread = conversation.unread || (!isOutgoing && !message.read_at);
    grouped.set(participantId, conversation);
  });

  return [...grouped.values()]
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      preview: conversation.messages.at(-1)?.text ?? "",
      time: formatMessageTime(conversation.latestAt),
    }))
    .sort((left, right) => right.latestAt.localeCompare(left.latestAt));
}

function MessagesPage() {
  const { session, profile } = useAuth();
  const { previewRole } = useDevPreview();
  const isPreview = previewRole === "farm_admin";
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(isPreview ? devConversations[0]?.id ?? null : null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (isPreview || !session?.access_token) return;

    let active = true;
    setLoading(true);
    setError(null);
    fetchMessages(session.access_token)
      .then((data) => {
        if (active) setMessages(data);
      })
      .catch((err) => {
        if (active) setError(err?.message ?? "Could not load messages.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token, isPreview]);

  const conversations = useMemo(
    () => (isPreview ? devConversations : buildConversations(messages, profile?.id)),
    [isPreview, messages, profile?.id],
  );

  useEffect(() => {
    if (selectedId && conversations.some((item) => item.id === selectedId)) return;
    setSelectedId(conversations[0]?.id ?? null);
  }, [conversations, selectedId]);

  const conversation = isPreview
    ? devConversationById(selectedId)
    : conversations.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (isPreview || !conversation || !session?.access_token) return;
    const unreadMessages = conversation.messages.filter(
      (message) => message.from === "farmer" && !message.readAt,
    );
    unreadMessages.forEach((message) => {
      markMessageRead(message.id, session.access_token)
        .then((updated) => {
          setMessages((current) => current.map((item) => (
            item.id === updated.id ? updated : item
          )));
        })
        .catch(() => {});
    });
  }, [conversation, isPreview, session?.access_token]);

  async function handleSend(event) {
    event.preventDefault();
    if (!draft.trim() || !conversation) return;
    if (isPreview) {
      setNotice(true);
      setDraft("");
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      const sent = await sendMessage(conversation.id, draft.trim(), session.access_token);
      setMessages((current) => [...current, sent]);
    } catch (err) {
      setSendError(err?.message ?? "Could not send the message.");
      return;
    } finally {
      setSending(false);
    }
    setDraft("");
  }

  if (!isPreview && !profile?.farmId) return null;

  return (
    <div aria-label="Messages">
      <PageHeader title="Messages" subtitle="Conversations with the farmers on your farm." />

      <div className="messages-layout">
        <div className="conversation-list" role="list" aria-label="Conversations">
          {loading ? null : conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={["conversation-item", item.id === selectedId ? "active" : ""].join(" ")}
              role="listitem"
              aria-current={item.id === selectedId ? "true" : undefined}
              onClick={() => {
                setSelectedId(item.id);
              }}
            >
              <Avatar name={item.farmerName} />
              <span className="conversation-item-main">
                <span className="conversation-name">
                  {item.farmerName}
                  <span className="conversation-time">{item.time}</span>
                </span>
                <span className="conversation-preview">{item.preview}</span>
              </span>
              {item.unread && <span className="unread-dot" aria-label="Unread" />}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState message="Loading messages..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : conversation ? (
          <section className="thread-card" aria-label={`Conversation with ${conversation.farmerName}`}>
            <div className="thread-header">
              <h2>{conversation.farmerName}</h2>
            </div>

            <div className="thread-messages">
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={message.from === "admin" ? "msg msg-out" : "msg msg-in"}
                >
                  {message.text}
                  <span className="msg-time">{message.time}</span>
                </div>
              ))}
            </div>

            <form className="composer" onSubmit={handleSend}>
              <label htmlFor="messageDraft" className="visually-hidden">
                Write a message
              </label>
              <textarea
                id="messageDraft"
                rows={2}
                placeholder="Write a message…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" variant="primary" aria-label="Send message" disabled={sending}>
                <Icon name="send" />
              </Button>
            </form>

            {sendError ? (
              <p className="thread-notice form-error" role="alert">{sendError}</p>
            ) : notice ? (
              <p className="thread-notice" role="status">
                Preview only. This message was not sent.
              </p>
            ) : isPreview ? (
              <p className="thread-notice">
                Messages are a preview of the upcoming messaging feature.
              </p>
            ) : null}
          </section>
        ) : (
          <EmptyState title="No conversation selected" />
        )}
      </div>
    </div>
  );
}

export default MessagesPage;