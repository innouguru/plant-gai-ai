import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchMessages, markMessageRead, sendMessage } from "../../api/messages";
import { fetchFarmMembers } from "../../api/farms";
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
  const isAdmin = profile?.role === "farm_admin";
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(isPreview ? devConversations[0]?.id ?? null : null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [notice, setNotice] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [farmMembers, setFarmMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);

  const loadMessages = useCallback(async () => {
    if (isPreview || !session?.access_token) return;
    setError(null);
    try {
      const data = await fetchMessages(session.access_token);
      setMessages(data);
    } catch (err) {
      setError(err?.message ?? "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [isPreview, session?.access_token]);

  useEffect(() => {
    if (isPreview || !session?.access_token) return;

    let active = true;
    setLoading(true);
    loadMessages();
    return () => {
      active = false;
    };
  }, [loadMessages, isPreview, session?.access_token]);

  // Polling every 15s and on window focus
  useEffect(() => {
    if (isPreview || !session?.access_token) return;
    // Disable polling in test environment to avoid hanging vitest
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") return;
    const interval = setInterval(() => {
      fetchMessages(session.access_token)
        .then((data) => setMessages(data))
        .catch(() => {});
    }, 15000);
    const onFocus = () => {
      fetchMessages(session.access_token)
        .then((data) => setMessages(data))
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isPreview, session?.access_token]);

  const conversations = useMemo(
    () => (isPreview ? devConversations : buildConversations(messages, profile?.id)),
    [isPreview, messages, profile?.id],
  );

  // Pending farmer for new conversation (admin starting with no history)
  const [pendingFarmer, setPendingFarmer] = useState(null);

  useEffect(() => {
    if (selectedId && conversations.some((item) => item.id === selectedId)) return;
    // Keep synthetic pending farmer selected if it exists
    if (pendingFarmer && pendingFarmer.id === selectedId) return;
    setSelectedId(conversations[0]?.id ?? null);
  }, [conversations, selectedId, pendingFarmer]);

  const conversation = useMemo(() => {
    if (isPreview) return devConversationById(selectedId);
    const found = conversations.find((item) => item.id === selectedId) ?? null;
    if (found) return found;
    if (pendingFarmer && pendingFarmer.id === selectedId) {
      return {
        id: pendingFarmer.id,
        farmerName: pendingFarmer.full_name ?? pendingFarmer.email,
        messages: [],
        preview: "",
        time: "",
        latestAt: "",
      };
    }
    return null;
  }, [isPreview, conversations, selectedId, pendingFarmer]);

  const markedReadRef = useRef(new Set());

  useEffect(() => {
    if (isPreview || !conversation || !session?.access_token) return;
    const unreadMessages = conversation.messages.filter(
      (message) => message.from === "farmer" && !message.readAt,
    );
    unreadMessages.forEach((message) => {
      if (markedReadRef.current.has(message.id)) return;
      markedReadRef.current.add(message.id);
      markMessageRead(message.id, session.access_token)
        .then((updated) => {
          setMessages((current) => current.map((item) => (
            item.id === updated.id ? { ...item, ...updated } : item
          )));
        })
        .catch(() => {});
    });
  }, [conversation, isPreview, session?.access_token]);

  async function handleStartNewConversation() {
    if (!profile?.farmId || !session?.access_token) return;
    setShowNewConversation(true);
    setMembersLoading(true);
    setMembersError(null);
    try {
      const members = await fetchFarmMembers(profile.farmId, session.access_token);
      const farmers = members.filter((m) => m.role === "farmer");
      setFarmMembers(farmers);
    } catch (err) {
      setMembersError(err?.message ?? "Could not load farmers.");
    } finally {
      setMembersLoading(false);
    }
  }

  function handleSelectFarmer(farmer) {
    setPendingFarmer(farmer);
    setSelectedId(farmer.id);
    setShowNewConversation(false);
    setSendError(null);
  }

  function handleCancelNewConversation() {
    setShowNewConversation(false);
  }

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
      setPendingFarmer(null);
    } catch (err) {
      setSendError(err?.message ?? "Could not send the message.");
      return;
    } finally {
      setSending(false);
    }
    setDraft("");
  }

  if (!isPreview && !profile?.farmId) return null;

  const subtitle = isAdmin
    ? "Conversations with the farmers on your farm."
    : "Conversation with your farm administrator.";

  return (
    <div aria-label="Messages">
      <PageHeader title="Messages" subtitle={subtitle} />

      <div className="messages-layout">
        <div className="conversation-list" role="list" aria-label="Conversations">
          {isAdmin && !isPreview && (
            <Button
              variant="primary"
              block
              onClick={handleStartNewConversation}
              aria-label="New Message"
              disabled={membersLoading}
            >
              New Message
            </Button>
          )}
          {showNewConversation && isAdmin ? (
            <div className="new-conversation-picker" aria-label="Select farmer">
              <h3>Select a farmer</h3>
              {membersLoading ? (
                <LoadingState message="Loading farmers..." />
              ) : membersError ? (
                <ErrorState message={membersError} onRetry={handleStartNewConversation} />
              ) : farmMembers.length === 0 ? (
                <EmptyState title="No farmers yet" message="Invite a farmer to start messaging." />
              ) : (
                farmMembers.map((farmer) => (
                  <button
                    key={farmer.id}
                    type="button"
                    className="conversation-item"
                    onClick={() => handleSelectFarmer(farmer)}
                    aria-label={`Message ${farmer.full_name ?? farmer.email}`}
                  >
                    <Avatar name={farmer.full_name ?? farmer.email} />
                    <span className="conversation-item-main">
                      <span className="conversation-name">{farmer.full_name ?? farmer.email}</span>
                      <span className="conversation-preview">{farmer.email}</span>
                    </span>
                  </button>
                ))
              )}
              <Button variant="outline" block onClick={handleCancelNewConversation}>
                Cancel
              </Button>
            </div>
          ) : loading ? null : (
            conversations.map((item) => (
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
            ))
          )}
          {!loading && !showNewConversation && conversations.length === 0 && !isPreview && (
            <EmptyState
              title={isAdmin ? "No conversations yet" : "No messages yet"}
              message={isAdmin ? "Start a new conversation to message a farmer." : "Your farm administrator will message you here."}
            />
          )}
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
              {conversation.messages.length === 0 ? (
                <p className="thread-notice">No messages yet. Send the first message below.</p>
              ) : (
                conversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.from === "admin" ? "msg msg-out" : "msg msg-in"}
                  >
                    {message.text}
                    <span className="msg-time">{message.time}</span>
                  </div>
                ))
              )}
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
        ) : showNewConversation ? (
          <EmptyState title="Select a farmer to start messaging" />
        ) : (
          <EmptyState title="No conversation selected" />
        )}
      </div>
    </div>
  );
}

export default MessagesPage;