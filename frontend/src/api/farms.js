import { request } from "./client";

export function fetchFarmMembers(farmId, token) {
  return request(`/farms/${farmId}/members`, { token });
}