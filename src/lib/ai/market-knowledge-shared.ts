/** Market AI — extra upload types beyond agent knowledge shared list */

export const MARKET_EXTRA_EXTENSIONS = [".pptx", ".xlsx", ".xls"] as const;

export const MARKET_UPLOAD_ACCEPT = [
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
  ".pptx",
  ".xlsx",
  ".xls",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "application/rtf",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
].join(",");

export function isAllowedMarketFilename(filename: string) {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = filename.slice(dot).toLowerCase();
  const base = [
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
  ];
  return base.includes(ext) || (MARKET_EXTRA_EXTENSIONS as readonly string[]).includes(ext);
}
