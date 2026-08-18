import { request } from "./client";

export function fetchMe(token) {
  return request("/auth/me", { token });
}