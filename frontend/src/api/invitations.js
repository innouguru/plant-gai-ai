import { request } from "./client";

export function createInvitation(email, fullName, token) {
  return request("/invitations", {
    method: "POST",
    body: { email, ...(fullName ? { full_name: fullName } : {}) },
    token,
  });
}

export function acceptInvitation(fullName, token) {
  return request("/invitations/accept", {
    method: "POST",
    body: { full_name: fullName },
    token,
  });
}