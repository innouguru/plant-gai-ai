import { request } from "./client";

export function fetchFarmMembers(farmId, token) {
  return request(`/farms/${farmId}/members`, { token });
}

export function fetchFarmStatistics(farmId, token) {
  return request(`/farms/${farmId}/statistics`, { token });
}

export function fetchFarmDiagnoses(farmId, token, { limit = 20, offset = 0 } = {}) {
  return request(`/farms/${farmId}/diagnoses?limit=${limit}&offset=${offset}`, { token });
}