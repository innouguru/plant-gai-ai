import { request } from "./client";

/** Upload a leaf photo and return the persisted { id, disease, confidence, crop, model_version, created_at }. */
export function submitDiagnosis(file, token) {
  const form = new FormData();
  form.append("image", file, file.name);
  return request("/diagnosis", { method: "POST", body: form, token });
}

/** Return the farmer's own diagnoses, newest first. */
export function fetchHistory(token) {
  return request("/diagnosis/history", { token });
}

/** Return one of the farmer's own diagnoses by id. */
export function fetchDiagnosis(id, token) {
  return request(`/diagnosis/${id}`, { token });
}