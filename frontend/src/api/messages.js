import { request } from "./client";

/** Return messages visible to the authenticated user. */
export function fetchMessages(token) {
  return request("/messages", { token });
}

/** Send a message to another member of the authenticated user's farm. */
export function sendMessage(recipientId, body, token) {
  return request("/messages", {
    method: "POST",
    body: { recipient_id: recipientId, body },
    token,
  });
}

/** Mark one received message as read. */
export function markMessageRead(messageId, token) {
  return request(`/messages/${messageId}/read`, { method: "PATCH", token });
}