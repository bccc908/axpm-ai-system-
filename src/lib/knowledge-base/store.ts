import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { canApproveKnowledge, canEditKnowledge } from "@/lib/knowledge-base/access";
import { removeArticleFiles } from "@/lib/knowledge-base/files";
import { parseStaffSourceLink } from "@/lib/knowledge-base/links";
import { normalizeStoredArticle } from "@/lib/knowledge-base/normalize";
import {
  KNOWLEDGE_SECTIONS,
  type KnowledgeSectionId,
  type KnowledgeStatus,
} from "@/lib/knowledge-base/sections";
import { createArticleSchema, sourceLinkSchema, updateArticleSchema } from "@/lib/knowledge-base/schema";
import { articleMatchesOrigin, articleMatchesQuery, toArticleSummary } from "@/lib/knowledge-base/search";
import { loadSeedArticles } from "@/lib/knowledge-base/seed";
import type { z } from "zod";
import type {
  KnowledgeActor,
  KnowledgeArticle,
  KnowledgeArticleSummary,
  KnowledgeData,
  KnowledgeOriginFilter,
  KnowledgeSourceLink,
} from "@/lib/knowledge-base/types";

/**
 * Staff enterprise knowledge base.
 * Persisted as JSON under data/, same pattern as finance and reply drafts.
 * This is not the AI upload corpus (agent-knowledge / market-knowledge).
 * Approved articles are reference only. This module never sends a client message.
 */

export class KnowledgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "forbidden" | "approve_required" | "invalid" | "not_found" | "not_connected",
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}

export function getKnowledgeBaseFile() {
  return (
    process.env.AXPM_KNOWLEDGE_BASE_FILE?.trim() ||
    path.join(process.cwd(), "data", "knowledge-base.json")
  );
}

let chain: Promise<void> = Promise.resolve();

function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensure(): Promise<KnowledgeData> {
  const file = getKnowledgeBaseFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    const data: KnowledgeData = { articles: await loadSeedArticles() };
    await fs.writeFile(file, JSON.stringify(data, null, 2));
    return data;
  }
  const raw = await fs.readFile(file, "utf-8");
  let parsed: Partial<KnowledgeData>;
  try {
    parsed = JSON.parse(raw) as Partial<KnowledgeData>;
  } catch {
    throw new KnowledgeError("知识库文件无法读取", 500, "invalid");
  }
  const articles = Array.isArray(parsed.articles) ? parsed.articles : [];
  return { articles: articles.flatMap((item) => normalizeStoredArticle(item) ?? []) };
}

async function write(data: KnowledgeData) {
  const file = getKnowledgeBaseFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function invalid(error: ZodError): KnowledgeError {
  const message = error.issues[0]?.message || "文档内容无效";
  return new KnowledgeError(message, 400, "invalid");
}

async function assertApprovedBodyIsNotATemplate(body: string) {
  const seeds = await loadSeedArticles();
  const normalized = body.trim();
  if (seeds.some((seed) => seed.body.trim() === normalized)) {
    throw new KnowledgeError(
      "编写指南不能直接标为已批准。请先写入已经同意的原文。",
      400,
      "invalid",
    );
  }
}

function sortArticles(articles: KnowledgeArticle[], query: string): KnowledgeArticle[] {
  const sectionOrder = new Map(KNOWLEDGE_SECTIONS.map((section, index) => [section.id, index]));
  return [...articles].sort((a, b) => {
    if (!query.trim()) {
      const sectionDiff = (sectionOrder.get(a.section) ?? 99) - (sectionOrder.get(b.section) ?? 99);
      if (sectionDiff !== 0) return sectionDiff;
    }
    const updated = b.updatedAt.localeCompare(a.updatedAt);
    if (updated !== 0) return updated;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

export interface KnowledgeQuery {
  section?: KnowledgeSectionId;
  status?: KnowledgeStatus;
  origin?: KnowledgeOriginFilter;
  q?: string;
}

type IncomingLink = z.infer<typeof sourceLinkSchema>;

function acceptLinks(links: IncomingLink[] | undefined): KnowledgeSourceLink[] {
  if (!links) return [];
  return links.map((link) => {
    const parsed = parseStaffSourceLink(link.url, link.kind);
    if (!parsed.ok || parsed.link.kind !== link.kind) {
      throw new KnowledgeError("链接不是 Google Drive 或 Obsidian 链接", 400, "invalid");
    }
    const id = link.id && /^[A-Za-z0-9][A-Za-z0-9_-]{7,80}$/.test(link.id) ? link.id : randomUUID();
    return {
      id,
      kind: parsed.link.kind,
      url: parsed.link.url,
      label: link.label.trim() || parsed.link.label,
    };
  });
}

function linkSignature(links: KnowledgeSourceLink[]) {
  return JSON.stringify(links.map((link) => [link.kind, link.url, link.label]));
}

export async function listKnowledgeArticles(query: KnowledgeQuery = {}): Promise<{
  articles: KnowledgeArticleSummary[];
  sections: Array<{ id: KnowledgeSectionId; zh: string; en: string; count: number }>;
  stats: { total: number; template: number; draft: number; approved: number };
}> {
  return exclusive(async () => {
    const data = await ensure();
    const q = query.q?.trim() ?? "";
    const matched = data.articles.filter((article) => {
      if (query.status && article.status !== query.status) return false;
      if (query.origin && query.origin !== "all" && !articleMatchesOrigin(article, query.origin)) return false;
      return articleMatchesQuery(article, q);
    });
    const visible = query.section ? matched.filter((article) => article.section === query.section) : matched;
    const stats = {
      total: data.articles.length,
      template: data.articles.filter((article) => article.status === "template").length,
      draft: data.articles.filter((article) => article.status === "draft").length,
      approved: data.articles.filter((article) => article.status === "approved").length,
    };
    return {
      articles: sortArticles(visible, q).map((article) => toArticleSummary(article, q)),
      sections: KNOWLEDGE_SECTIONS.map((section) => ({
        ...section,
        count: matched.filter((article) => article.section === section.id).length,
      })),
      stats,
    };
  });
}

export async function getKnowledgeArticle(id: string): Promise<KnowledgeArticle | null> {
  return exclusive(async () => {
    const data = await ensure();
    return data.articles.find((article) => article.id === id) ?? null;
  });
}

export async function createKnowledgeArticle(input: unknown, actor: KnowledgeActor): Promise<KnowledgeArticle> {
  if (!canEditKnowledge(actor.role)) {
    throw new KnowledgeError("无权限", 403, "forbidden");
  }
  const parsed = createArticleSchema.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  const status = parsed.data.status ?? "draft";
  if (status !== "draft" && !canApproveKnowledge(actor.role)) {
    throw new KnowledgeError("只有所有者或管理员可以把文档标为模板或已批准", 403, "approve_required");
  }
  if (status === "approved") {
    await assertApprovedBodyIsNotATemplate(parsed.data.body);
  }
  const links = acceptLinks(parsed.data.links);

  return exclusive(async () => {
    const data = await ensure();
    const now = new Date().toISOString();
    const article: KnowledgeArticle = {
      id: randomUUID(),
      title: parsed.data.title,
      section: parsed.data.section,
      body: parsed.data.body,
      status,
      ownerName: parsed.data.ownerName || actor.name.trim() || "Staff",
      ownerUserId: actor.id,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.name,
      source: "manual",
      externalKey: null,
      links,
      attachments: [],
    };
    data.articles.unshift(article);
    await write(data);
    return article;
  });
}

export async function updateKnowledgeArticle(
  id: string,
  input: unknown,
  actor: KnowledgeActor,
): Promise<{ article: KnowledgeArticle; demoted: boolean }> {
  if (!canEditKnowledge(actor.role)) {
    throw new KnowledgeError("无权限", 403, "forbidden");
  }
  const parsed = updateArticleSchema.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  const patch = parsed.data;
  if (patch.status && patch.status !== "draft" && !canApproveKnowledge(actor.role)) {
    throw new KnowledgeError("只有所有者或管理员可以把文档标为模板或已批准", 403, "approve_required");
  }
  const nextLinks = patch.links === undefined ? undefined : acceptLinks(patch.links);

  return exclusive(async () => {
    const data = await ensure();
    const article = data.articles.find((item) => item.id === id);
    if (!article) throw new KnowledgeError("找不到文档", 404, "not_found");

    const linksChanged = nextLinks !== undefined && linkSignature(nextLinks) !== linkSignature(article.links);
    const unchanged =
      (patch.title === undefined || patch.title === article.title) &&
      (patch.body === undefined || patch.body === article.body) &&
      (patch.section === undefined || patch.section === article.section) &&
      (patch.ownerName === undefined || patch.ownerName === article.ownerName) &&
      (patch.status === undefined || patch.status === article.status) &&
      !linksChanged;
    if (unchanged) return { article, demoted: false };

    const contentChanged =
      (patch.title !== undefined && patch.title !== article.title) ||
      (patch.body !== undefined && patch.body !== article.body) ||
      (patch.section !== undefined && patch.section !== article.section) ||
      linksChanged;

    let status = patch.status ?? article.status;
    let demoted = false;
    if (contentChanged && article.status === "approved" && !canApproveKnowledge(actor.role)) {
      status = "draft";
      demoted = true;
    }
    if (patch.status === "approved" && canApproveKnowledge(actor.role)) {
      status = "approved";
      demoted = false;
    }
    if (status === "approved") {
      await assertApprovedBodyIsNotATemplate(patch.body ?? article.body);
    }

    article.title = patch.title ?? article.title;
    article.section = patch.section ?? article.section;
    article.body = patch.body ?? article.body;
    article.ownerName = patch.ownerName ?? article.ownerName;
    if (nextLinks) article.links = nextLinks;
    article.status = status;
    article.updatedAt = new Date().toISOString();
    article.updatedBy = actor.name;
    await write(data);
    return { article, demoted };
  });
}

export async function deleteKnowledgeArticle(id: string, actor: KnowledgeActor): Promise<void> {
  if (!canApproveKnowledge(actor.role)) {
    throw new KnowledgeError("无权限", 403, "forbidden");
  }
  return exclusive(async () => {
    const data = await ensure();
    const removed = data.articles.find((article) => article.id === id);
    if (!removed) throw new KnowledgeError("找不到文档", 404, "not_found");
    data.articles = data.articles.filter((article) => article.id !== id);
    await write(data);
    await removeArticleFiles(removed.id);
  });
}

export function withKnowledgeData<T>(
  fn: (ctx: { data: KnowledgeData; save: () => Promise<void> }) => Promise<T>,
): Promise<T> {
  return exclusive(async () => {
    const data = await ensure();
    return fn({ data, save: () => write(data) });
  });
}

export interface ApprovedKnowledgeMatch {
  id: string;
  title: string;
  section: KnowledgeSectionId;
  ownerName: string;
  updatedAt: string;
  excerpt: string;
  status: "approved";
}

/**
 * Staff lookup of approved answers only.
 * Template guides and drafts are never returned. Nothing is sent to a client.
 */
export async function lookupApprovedKnowledge(query: string): Promise<ApprovedKnowledgeMatch[]> {
  const q = query.trim();
  if (q.length < 2 || q.length > 200) return [];
  return exclusive(async () => {
    const data = await ensure();
    const approved = data.articles.filter((article) => article.status === "approved");
    return sortArticles(
      approved.filter((article) => articleMatchesQuery(article, q)),
      q,
    )
      .slice(0, 8)
      .map((article) => ({
        id: article.id,
        title: article.title,
        section: article.section,
        ownerName: article.ownerName,
        updatedAt: article.updatedAt,
        excerpt: toArticleSummary(article, q).excerpt,
        status: "approved" as const,
      }));
  });
}
