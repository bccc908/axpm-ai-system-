import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

export function getKnowledgeFilesRoot() {
  return (
    process.env.AXPM_KNOWLEDGE_FILES_DIR?.trim() ||
    path.join(process.cwd(), "data", "knowledge-base-files")
  );
}

export function assertStorageId(id: string): string {
  if (!ID_RE.test(id)) {
    throw new Error("Invalid knowledge file id");
  }
  return id;
}

export function attachmentPath(articleId: string, attachmentId: string): string {
  const root = path.resolve(getKnowledgeFilesRoot());
  const full = path.resolve(root, assertStorageId(articleId), assertStorageId(attachmentId));
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid knowledge file path");
  }
  return full;
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function writeAttachmentFile(articleId: string, attachmentId: string, buffer: Buffer) {
  const full = attachmentPath(articleId, attachmentId);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

export async function readAttachmentFile(articleId: string, attachmentId: string): Promise<Buffer> {
  return fs.readFile(attachmentPath(articleId, attachmentId));
}

export async function removeAttachmentFile(articleId: string, attachmentId: string) {
  await fs.rm(attachmentPath(articleId, attachmentId), { force: true });
}

export async function removeArticleFiles(articleId: string) {
  const root = path.resolve(getKnowledgeFilesRoot());
  const dir = path.resolve(root, assertStorageId(articleId));
  if (!dir.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid knowledge file path");
  }
  await fs.rm(dir, { recursive: true, force: true });
}

export function contentDisposition(fileName: string, mimeType: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "") || "file";
  const encoded = encodeURIComponent(fileName);
  const inline = mimeType.startsWith("image/") || mimeType.startsWith("text/") || mimeType === "application/pdf";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
