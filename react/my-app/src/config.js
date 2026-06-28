export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
export const USER_ID = import.meta.env.VITE_USER_ID ?? "user123";

export const ACCEPTED_FILE_TYPES = [".pdf", ".txt", ".md", ".docx", ".csv", ".json"];
export const ACCEPTED_EXTENSIONS = ACCEPTED_FILE_TYPES.map((type) => type.slice(1));

export const SUGGESTED_QUESTIONS = [
  "Summarize the key points",
  "What are the main topics covered?",
  "List all important dates and deadlines",
  "Explain the terms and conditions",
];
