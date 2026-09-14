const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const NETWORK_ERROR_MESSAGE =
  "Unable to connect. Please check your internet connection and try again.";
export const TIMEOUT_ERROR_MESSAGE =
  "Request timed out. The server is taking too long to respond. Please try with a smaller image or check your connection.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again.";

// Render free tier (0.1 CPU) + ResNet-18 inference + cold start can approach the 30s proxy timeout.
// Use a client timeout slightly above that to distinguish server overload from offline.
const REQUEST_TIMEOUT_MS = 35000;

export function isSessionExpiredError(error) {
  return Boolean(error?.sessionExpired);
}

export async function request(path, { method = "GET", body, token } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  let response;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    const isTimeout = err?.name === "AbortError";
    const error = new Error(isTimeout ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE);
    error.networkError = true;
    error.timeoutError = Boolean(isTimeout);
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // keep the fallback message
    }
    const error = new Error(message);
    error.status = response.status;
    error.sessionExpired = error.status === 401 && message === SESSION_EXPIRED_MESSAGE;
    throw error;
  }

  return response.json();
}

export function getJson(path) {
  return request(path);
}