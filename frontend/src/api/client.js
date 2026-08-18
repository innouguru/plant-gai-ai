const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const NETWORK_ERROR_MESSAGE =
  "Unable to connect. Please check your internet connection and try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again.";

export function isSessionExpiredError(error) {
  return Boolean(error?.sessionExpired);
}

export async function request(path, { method = "GET", body, token } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error(NETWORK_ERROR_MESSAGE);
    error.networkError = true;
    throw error;
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