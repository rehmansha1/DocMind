export function getFileExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "file";
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function createDocumentFromFile(file) {
  return {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    name: file.name,
    size: file.size,
    ext: getFileExtension(file.name),
    status: "processing",
    addedAt: new Date(),
  };
}
