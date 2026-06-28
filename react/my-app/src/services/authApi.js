import { API_BASE_URL } from "../config";

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Authentication failed");
  }

  return data;
}

export async function login({ email, password, rememberMe }) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe }),
  });

  return parseJsonResponse(response);
}
