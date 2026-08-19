import { request } from "./client";

/** Upload a leaf photo and return { disease, confidence, crop, model_version }. */
export function submitDiagnosis(file, token) {
  const form = new FormData();
  form.append("image", file, file.name);
  return request("/diagnosis", { method: "POST", body: form, token });
}