import { isKnowledgeSection, isKnowledgeStatus } from "@/lib/knowledge-base/sections";
import type {
  KnowledgeArticle,
  KnowledgeAttachment,
  KnowledgeSource,
  KnowledgeSourceLink,
} from "@/lib/knowledge-base/types";

function asLink(value: unknown): KnowledgeSourceLink | null {
  if (!value || typeof value !== "object") return null;
  const link = value as Partial<KnowledgeSourceLink>;
  if (link.kind !== "google_drive" && link.kind !== "obsidian") return null;
  if (typeof link.id !== "string" || typeof link.url !== "string" || typeof link.label !== "string") return null;
  if (!link.url.trim() || !link.label.trim()) return null;
  return { id: link.id, kind: link.kind, url: link.url, label: link.label };
}

function asAttachment(value: unknown): KnowledgeAttachment | null {
  if (!value || typeof value !== "object") return null;
  const file = value as Partial<KnowledgeAttachment>;
  if (typeof file.id !== "string" || typeof file.fileName !== "string" || typeof file.mimeType !== "string") {
    return null;
  }
  if (file.source !== "upload" && file.source !== "google_drive" && file.source !== "obsidian") return null;
  if (typeof file.size !== "number" || typeof file.createdAt !== "string") return null;
  return {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    source: file.source,
    externalKey: typeof file.externalKey === "string" ? file.externalKey : null,
    sha256: typeof file.sha256 === "string" ? file.sha256 : "",
    createdAt: file.createdAt,
    createdBy: typeof file.createdBy === "string" ? file.createdBy : null,
  };
}

function asSource(value: unknown): KnowledgeSource {
  if (value === "google_drive" || value === "obsidian" || value === "manual") return value;
  return "manual";
}

/** Older library files have no source, links, or attachments. */
export function normalizeStoredArticle(raw: unknown): KnowledgeArticle | null {
  if (!raw || typeof raw !== "object") return null;
  const article = raw as Partial<KnowledgeArticle>;
  if (typeof article.id !== "string" || typeof article.title !== "string" || typeof article.body !== "string") {
    return null;
  }
  if (typeof article.section !== "string" || !isKnowledgeSection(article.section)) return null;
  if (typeof article.status !== "string" || !isKnowledgeStatus(article.status)) return null;
  return {
    id: article.id,
    title: article.title,
    section: article.section,
    body: article.body,
    status: article.status,
    ownerName: typeof article.ownerName === "string" && article.ownerName.trim() ? article.ownerName : "Staff",
    ownerUserId: typeof article.ownerUserId === "string" ? article.ownerUserId : null,
    createdAt: typeof article.createdAt === "string" ? article.createdAt : new Date(0).toISOString(),
    updatedAt: typeof article.updatedAt === "string" ? article.updatedAt : new Date(0).toISOString(),
    updatedBy: typeof article.updatedBy === "string" ? article.updatedBy : null,
    source: asSource(article.source),
    externalKey: typeof article.externalKey === "string" ? article.externalKey : null,
    links: Array.isArray(article.links) ? article.links.flatMap((link) => asLink(link) ?? []) : [],
    attachments: Array.isArray(article.attachments)
      ? article.attachments.flatMap((file) => asAttachment(file) ?? [])
      : [],
  };
}
