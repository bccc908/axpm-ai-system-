import type { UserRole } from "@/lib/auth/types";
import type { KnowledgeSectionId, KnowledgeStatus } from "@/lib/knowledge-base/sections";

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
}

export interface KnowledgeData {
  articles: KnowledgeArticle[];
}

export interface KnowledgeActor {
  id: string;
  name: string;
  role: UserRole;
}
