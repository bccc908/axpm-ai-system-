import type { UserRole } from "@/lib/auth/types";
import type { KnowledgeSectionId, KnowledgeStatus } from "@/lib/knowledge-base/sections";

export const KNOWLEDGE_SOURCES = ["manual", "google_drive", "obsidian"] as const;
export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number];

export const KNOWLEDGE_ORIGIN_FILTERS = ["all", "uploaded", "google_drive", "obsidian"] as const;
export type KnowledgeOriginFilter = (typeof KNOWLEDGE_ORIGIN_FILTERS)[number];

export type KnowledgeLinkKind = "google_drive" | "obsidian";

export interface KnowledgeSourceLink {
  id: string;
  kind: KnowledgeLinkKind;
  url: string;
  label: string;
}

export type KnowledgeAttachmentSource = "upload" | "google_drive" | "obsidian";

export interface KnowledgeAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  source: KnowledgeAttachmentSource;
  /** Drive file id key, or Obsidian note path. Null for a file added on the article. */
  externalKey: string | null;
  sha256: string;
  createdAt: string;
  createdBy: string | null;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  section: KnowledgeSectionId;
  body: string;
  status: KnowledgeStatus;
  ownerName: string;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  source: KnowledgeSource;
  externalKey: string | null;
  links: KnowledgeSourceLink[];
  attachments: KnowledgeAttachment[];
}

export interface KnowledgeArticleSummary {
  id: string;
  title: string;
  section: KnowledgeSectionId;
  status: KnowledgeStatus;
  ownerName: string;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  excerpt: string;
  source: KnowledgeSource;
  links: Array<Pick<KnowledgeSourceLink, "kind" | "label" | "url">>;
  attachments: Array<Pick<KnowledgeAttachment, "id" | "fileName" | "mimeType" | "size" | "source">>;
}

export function isKnowledgeOrigin(value: string): value is KnowledgeOriginFilter {
  return (KNOWLEDGE_ORIGIN_FILTERS as readonly string[]).includes(value);
}

export interface KnowledgeData {
  articles: KnowledgeArticle[];
}

export interface KnowledgeActor {
  id: string;
  name: string;
  role: UserRole;
}
