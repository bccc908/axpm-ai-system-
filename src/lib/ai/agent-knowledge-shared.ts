/** Client-safe constants (do not import server-only modules in UI) */

export const AGENT_KNOWLEDGE_MAX_BYTES = 8 * 1024 * 1024;

/** File extensions allowed for agent training */
export const AGENT_KNOWLEDGE_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".pdf",
  ".docx",
  ".doc",
  ".rtf",
  ".html",
  ".htm",
  ".xml",
  ".log",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
] as const;

/** Extensions + MIME types so macOS/Windows file dialogs show documents, not only photos */
export const AGENT_KNOWLEDGE_ACCEPT = [
  ...AGENT_KNOWLEDGE_EXTENSIONS,
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "text/html",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
].join(",");

export function getKnowledgeFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

export function isAllowedKnowledgeFilename(filename: string): boolean {
  const ext = getKnowledgeFileExtension(filename);
  return (AGENT_KNOWLEDGE_EXTENSIONS as readonly string[]).includes(ext);
}

const MIME_BY_EXT: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".rtf": "application/rtf",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function normalizeKnowledgeMimeType(filename: string, mimeType?: string) {
  const ext = getKnowledgeFileExtension(filename);
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  return MIME_BY_EXT[ext] ?? mimeType ?? "application/octet-stream";
}
