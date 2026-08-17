import { getJson } from "./client";

export function fetchHealth() {
  return getJson("/health");
}
