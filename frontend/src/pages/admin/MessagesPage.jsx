import { useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import Avatar from "../../components/ui/Avatar";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { devConversations, devConversationById } from "../../data/devMocks";

function MessagesPage() {
  const [selectedId, setSelectedId] = useState(devConversations[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState(false);

  const conversation = devConversationById(selectedId);

  function handleSend(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setNotice(true);
    setDraft("");
  }

  return (
    <div aria-label="Messages">
      <PageHeader title="Messages" subtitle="Conversations with the farmers on your farm." />

      <div className="messages-layout">
        <div className="conversation-list" role="list" aria-label="Conversations">
          {devConversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={["conversation-item", item.id === selectedId ? "active" : ""].join(" ")}
              role="listitem"
              aria-current={item.id === selectedId ? "true" : undefined}
              onClick={() => {
                setSelectedId(item.id);
                setNotice(false);
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

        {conversation ? (
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
              <Button type="submit" variant="primary" aria-label="Send message">
                <Icon name="send" />
              </Button>
            </form>

            {notice ? (
              <p className="thread-notice" role="status">
                Messaging is not connected yet. This feature will be available in a future
                update, so your message has not been sent.
              </p>
            ) : (
              <p className="thread-notice">
                Messages are a preview of the upcoming messaging feature.
              </p>
            )}
          </section>
        ) : (
          <EmptyState title="No conversation selected" />
        )}
      </div>
    </div>
  );
}

export default MessagesPage;