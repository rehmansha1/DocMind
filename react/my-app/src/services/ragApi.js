import { API_BASE_URL, USER_ID } from "../config";

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error ?? data.message ?? "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function uploadDocument(file, userId, onProgress, token = null) {
  const formData = new FormData();
  formData.append("userId", userId);
  console.log(userId, "IN rAG API");
  formData.append("file", file);

  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error ?? "Failed to upload document");
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);
          if (data.error) {
            throw new Error(data.error);
          }
          if (onProgress) {
            onProgress(data);
          }
          if (data.status === "completed") {
            return data;
          }
        } catch (e) {
          if (e.message !== "Unexpected end of JSON input") {
            throw e;
          }
        }
      }
    }
  }

  if (buffer.trim()) {
    const data = JSON.parse(buffer);
    if (data.error) throw new Error(data.error);
    return data;
  }
}

export async function askQuestion(question, userId, history = [], token = null, widgetKey = null) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      userId: userId || USER_ID,
      question,
      history,
      widgetKey,
    }),
  });

  return parseJsonResponse(response);
}

export async function fetchDocuments(userId, token = null) {
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(userId)}`, {
    headers
  });
  return parseJsonResponse(response);
}

export async function deleteDocument(userId, fileName, token = null) {
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`, {
    method: "DELETE",
    headers
  });
  return parseJsonResponse(response);
}

export async function crawlWebsite(url, userId, onProgress, token = null) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url,
      userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error ?? "Failed to crawl website");
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);
          if (data.error) {
            throw new Error(data.error);
          }
          if (onProgress) {
            onProgress(data);
          }
          if (data.status === "completed") {
            return data;
          }
        } catch (e) {
          if (e.message !== "Unexpected end of JSON input") {
            throw e;
          }
        }
      }
    }
  }

  if (buffer.trim()) {
    const data = JSON.parse(buffer);
    if (data.error) throw new Error(data.error);
    return data;
  }
}

export async function getAllowedDomains(token) {
  const response = await fetch(`${API_BASE_URL}/auth/domains`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  return parseJsonResponse(response);
}

export async function saveAllowedDomains(allowed_domains, token) {
  const response = await fetch(`${API_BASE_URL}/auth/domains`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ allowed_domains })
  });
  return parseJsonResponse(response);
}
