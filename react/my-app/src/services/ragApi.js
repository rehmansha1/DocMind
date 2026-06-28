import { API_BASE_URL, USER_ID } from "../config";

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? data.message ?? "Request failed");
  }

  return data;
}

export async function uploadDocument(file, userId, onProgress) {
  const formData = new FormData();
  formData.append("userId", userId);
  console.log(userId, "IN rAG API");
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to upload document");
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

export async function askQuestion(question, userId, history = []) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: userId || USER_ID,
      question,
      history,
    }),
  });

  return parseJsonResponse(response);
}

export async function fetchDocuments(userId) {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(userId)}`);
  return parseJsonResponse(response);
}

export async function deleteDocument(userId, fileName) {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`, {
    method: "DELETE",
  });
  return parseJsonResponse(response);
}

export async function crawlWebsite(url, userId, onProgress) {
  const response = await fetch(`${API_BASE_URL}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to crawl website");
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
