const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}
