import { plainKnowledgeText } from "@/lib/knowledge-base/markdown";
import { knowledgeSection } from "@/lib/knowledge-base/sections";
import type { KnowledgeArticle, KnowledgeArticleSummary } from "@/lib/knowledge-base/types";

export function knowledgeQueryTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function knowledgeHaystack(article: Pick<KnowledgeArticle, "title" | "body" | "ownerName" | "section">): string {
  const section = knowledgeSection(article.section);
  return [article.title, article.ownerName, section?.zh ?? "", section?.en ?? "", article.body]
    .join("\n")
    .toLowerCase();
}

export function articleMatchesQuery(article: KnowledgeArticle, query: string): boolean {
  const terms = knowledgeQueryTerms(query);
  if (terms.length === 0) return true;
  const haystack = knowledgeHaystack(article);
  return terms.every((term) => haystack.includes(term));
}

export function knowledgeExcerpt(body: string, query?: string): string {
  const plain = plainKnowledgeText(body);
  const term = knowledgeQueryTerms(query ?? "")[0];
  if (!term) return plain.slice(0, 180);
  const index = plain.toLowerCase().indexOf(term);
  if (index < 0) return plain.slice(0, 180);
  const start = Math.max(0, index - 48);
  const slice = plain.slice(start, start + 180).trim();
  return `${start > 0 ? "…" : ""}${slice}`;
}

export function toArticleSummary(article: KnowledgeArticle, query?: string): KnowledgeArticleSummary {
  return {
    id: article.id,
    title: article.title,
    section: article.section,
    status: article.status,
    ownerName: article.ownerName,
    ownerUserId: article.ownerUserId,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    updatedBy: article.updatedBy,
    excerpt: knowledgeExcerpt(article.body, query),
  };
}
