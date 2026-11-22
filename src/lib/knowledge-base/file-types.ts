/** Staff knowledge attachments. Client-safe: no Node APIs. */

export const KNOWLEDGE_FILE_ACCEPT =
  ".pdf,.doc,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.gif";

export const KNOWLEDGE_FILE_MAX_BYTES = 12 * 1024 * 1024;

export const KNOWLEDGE_FILE_MAX_COUNT = 12;

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

/** Returns a stored MIME type, or null when the file is not allowed. */
export function knowledgeFileMime(fileName: string, reportedMime = ""): string | null {
  const ext = fileExtension(fileName);
  const known = EXT_TO_MIME[ext];
  if (!known) return null;
  const reported = reportedMime.trim().toLowerCase();
  if (!reported || reported === "application/octet-stream") return known;
  if (reported === known) return known;
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    if (reported.startsWith("text/")) return known;
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    if (reported === "image/jpg" || reported === "image/pjpeg") return known;
  }
  return null;
}

export function safeDownloadName(fileName: string): string {
  const base = (fileName.split(/[/\\]/).pop() ?? "file").replace(/[\u0000-\u001f"]/g, "").trim();
  return (base || "file").slice(0, 180);
}
