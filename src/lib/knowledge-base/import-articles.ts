import { randomUUID } from "crypto";
import { canEditKnowledge } from "@/lib/knowledge-base/access";
import { extractKnowledgeText } from "@/lib/knowledge-base/extract-text";
import {
  KNOWLEDGE_FILE_MAX_BYTES,
  KNOWLEDGE_FILE_MAX_COUNT,
  knowledgeFileMime,
  safeDownloadName,
} from "@/lib/knowledge-base/file-types";
import { hashBuffer, removeAttachmentFile, writeAttachmentFile } from "@/lib/knowledge-base/files";
import { externalKeyForLink, parseStaffSourceLink, type ParsedSourceLink } from "@/lib/knowledge-base/links";
import { inferKnowledgeSection, splitMarkdownNote, titleFromFilename } from "@/lib/knowledge-base/routing";
import { KnowledgeError, withKnowledgeData } from "@/lib/knowledge-base/store";
import type { KnowledgeSectionId } from "@/lib/knowledge-base/sections";
import type {
  KnowledgeActor,
  KnowledgeArticle,
  KnowledgeAttachment,
  KnowledgeLinkKind,
  KnowledgeSource,
  KnowledgeSourceLink,
} from "@/lib/knowledge-base/types";

const MAX_BODY = 80_000;

export type PreparedKnowledgeImport = {
  source: Exclude<KnowledgeSource, "manual">;
  externalKey: string;
  title: string;
  section: KnowledgeSectionId;
  body: string;
  links: Array<Pick<KnowledgeSourceLink, "kind" | "url" | "label">>;
  file?: { fileName: string; mimeType: string; buffer: Buffer };
};

function clip(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function fallbackImportBody(source: Exclude<KnowledgeSource, "manual">, attached: boolean): string {
  const name = source === "google_drive" ? "Google Drive" : "Obsidian";
  if (attached) {
    return `Imported from ${name}. 从 ${name} 导入。\n\nThe file is attached to this draft. 文件附在这篇草稿上，仅员工可打开。`;
  }
  return `Imported from ${name}. 从 ${name} 导入。\n\nThis draft stores the link only. The file was not copied into KD. 这里只保存链接，文件本身没有复制进 KD。`;
}

export function isFallbackImportBody(body: string): boolean {
  return body.startsWith("Imported from Google Drive.") || body.startsWith("Imported from Obsidian.");
}

export function prepareLinkImport(
  raw: string,
  provider: KnowledgeLinkKind,
  section: KnowledgeSectionId,
  vaultName?: string,
): PreparedKnowledgeImport | null {
  const parsed = parseStaffSourceLink(raw, provider, { vaultName });
  if (!parsed.ok || parsed.link.kind !== provider) return null;
  const routed = inferKnowledgeSection(parsed.link.notePath, parsed.link.label) ?? section;
  return linkToPrepared(parsed.link, routed);
}

function linkToPrepared(link: ParsedSourceLink, section: KnowledgeSectionId): PreparedKnowledgeImport {
  return {
    source: link.kind,
    externalKey: externalKeyForLink(link),
    title: clip(link.label, 180),
    section,
    body: fallbackImportBody(link.kind, false),
    links: [{ kind: link.kind, url: link.url, label: link.label }],
  };
}

export async function prepareLocalFileImport(input: {
  source: Exclude<KnowledgeSource, "manual">;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  section: KnowledgeSectionId;
  externalKey: string;
  link?: { kind: KnowledgeLinkKind; url: string; label: string };
  attach?: boolean;
}): Promise<PreparedKnowledgeImport> {
  const mime = knowledgeFileMime(input.fileName, input.mimeType);
  if (!mime && input.attach !== false) {
    throw new KnowledgeError("不支持的文件类型", 400, "invalid");
  }
  if (input.buffer.length === 0 || input.buffer.length > KNOWLEDGE_FILE_MAX_BYTES) {
    throw new KnowledgeError("文件过大或为空", 400, "invalid");
  }
  const text = await extractKnowledgeText(input.fileName, mime || input.mimeType, input.buffer);
  const note = text && /\.(md|markdown|txt)$/i.test(input.fileName) ? splitMarkdownNote(text) : null;
  const title = clip(note?.title || titleFromFilename(input.fileName), 180);
  const bodyText = (note ? note.body : text)?.trim() ?? "";
  const attach = input.attach !== false && Boolean(mime);
  return {
    source: input.source,
    externalKey: input.externalKey.slice(0, 500),
    title,
    section: input.section,
    body: clip(bodyText || fallbackImportBody(input.source, attach), MAX_BODY),
    links: input.link ? [input.link] : [],
    file: attach && mime
      ? { fileName: safeDownloadName(input.fileName), mimeType: mime, buffer: input.buffer }
      : undefined,
  };
}

function mergeLinks(
  existing: KnowledgeSourceLink[],
  incoming: Array<Pick<KnowledgeSourceLink, "kind" | "url" | "label">>,
): KnowledgeSourceLink[] {
  const next = [...existing];
  for (const link of incoming) {
    const index = next.findIndex((item) => item.kind === link.kind && item.url === link.url);
    if (index >= 0) {
      next[index] = { ...next[index], label: link.label, url: link.url };
    } else {
      next.push({ id: randomUUID(), kind: link.kind, url: link.url, label: link.label });
    }
  }
  return next.slice(0, 20);
}

export async function importPreparedArticles(
  items: PreparedKnowledgeImport[],
  actor: KnowledgeActor,
): Promise<{ articles: KnowledgeArticle[]; created: number; updated: number }> {
  if (!canEditKnowledge(actor.role)) {
    throw new KnowledgeError("无权限", 403, "forbidden");
  }
  if (items.length === 0) throw new KnowledgeError("没有可导入的文件", 400, "invalid");
  if (items.length > 25) throw new KnowledgeError("一次最多导入 25 篇", 400, "invalid");

  return withKnowledgeData(async ({ data, save }) => {
    const articles: KnowledgeArticle[] = [];
    let created = 0;
    let updated = 0;
    for (const item of items) {
      const key = item.externalKey.trim();
      if (!key || key.length > 500) throw new KnowledgeError("来源标识无效", 400, "invalid");
      const title = clip(item.title, 180);
      const body = clip(item.body, MAX_BODY);
      if (!title || !body) throw new KnowledgeError("文档内容无效", 400, "invalid");
      const now = new Date().toISOString();
      let article = data.articles.find((entry) => entry.externalKey === key);
      const isNew = !article;
      if (!article) {
        article = {
          id: randomUUID(),
          title,
          section: item.section,
          body,
          status: "draft",
          ownerName: actor.name.trim() || "Staff",
          ownerUserId: actor.id,
          createdAt: now,
          updatedAt: now,
          updatedBy: actor.name,
          source: item.source,
          externalKey: key,
          links: mergeLinks([], item.links),
          attachments: [],
        };
        data.articles.unshift(article);
        created += 1;
      } else {
        const linkOnly = !item.file;
        const nextLinks = mergeLinks(article.links, item.links);
        const nextBody = linkOnly && !isFallbackImportBody(article.body) ? article.body : body;
        const nextTitle = linkOnly && !isFallbackImportBody(article.body) ? article.title : title;
        const changed =
          article.title !== nextTitle ||
          article.body !== nextBody ||
          article.section !== item.section ||
          JSON.stringify(article.links.map((link) => [link.kind, link.url, link.label])) !==
            JSON.stringify(nextLinks.map((link) => [link.kind, link.url, link.label]));
        article.title = nextTitle;
        article.section = item.section;
        article.body = nextBody;
        article.links = nextLinks;
        article.source = item.source;
        if (changed) {
          article.status = "draft";
          article.updatedAt = now;
          article.updatedBy = actor.name;
          updated += 1;
        }
      }

      if (item.file) {
        const mime = knowledgeFileMime(item.file.fileName, item.file.mimeType);
        if (!mime) throw new KnowledgeError("不支持的文件类型", 400, "invalid");
        if (item.file.buffer.length === 0 || item.file.buffer.length > KNOWLEDGE_FILE_MAX_BYTES) {
          throw new KnowledgeError("文件过大或为空", 400, "invalid");
        }
        const sha256 = hashBuffer(item.file.buffer);
        const previous = article.attachments.find((attachment) => attachment.externalKey === key);
        if (previous?.sha256 === sha256) {
          articles.push(article);
          continue;
        }
        if (article.attachments.length >= KNOWLEDGE_FILE_MAX_COUNT && !previous) {
          throw new KnowledgeError("附件已满", 400, "invalid");
        }
        if (previous) {
          await removeAttachmentFile(article.id, previous.id);
          article.attachments = article.attachments.filter((attachment) => attachment.id !== previous.id);
        }
        const attachmentId = randomUUID();
        await writeAttachmentFile(article.id, attachmentId, item.file.buffer);
        const attachment: KnowledgeAttachment = {
          id: attachmentId,
          fileName: safeDownloadName(item.file.fileName),
          mimeType: mime,
          size: item.file.buffer.length,
          source: item.source,
          externalKey: key,
          sha256,
          createdAt: now,
          createdBy: actor.name,
        };
        article.attachments.push(attachment);
        article.updatedAt = now;
        article.updatedBy = actor.name;
        if (!isNew) article.status = "draft";
      }
      articles.push(article);
    }
    await save();
    return { articles, created, updated };
  });
}

export async function addArticleAttachment(
  articleId: string,
  file: { fileName: string; mimeType: string; buffer: Buffer },
  actor: KnowledgeActor,
): Promise<KnowledgeArticle> {
  if (!canEditKnowledge(actor.role)) throw new KnowledgeError("无权限", 403, "forbidden");
  const mime = knowledgeFileMime(file.fileName, file.mimeType);
  if (!mime) throw new KnowledgeError("不支持的文件类型", 400, "invalid");
  if (file.buffer.length === 0 || file.buffer.length > KNOWLEDGE_FILE_MAX_BYTES) {
    throw new KnowledgeError("文件过大或为空", 400, "invalid");
  }
  return withKnowledgeData(async ({ data, save }) => {
    const article = data.articles.find((item) => item.id === articleId);
    if (!article) throw new KnowledgeError("找不到文档", 404, "not_found");
    if (article.attachments.length >= KNOWLEDGE_FILE_MAX_COUNT) {
      throw new KnowledgeError("附件已满", 400, "invalid");
    }
    const now = new Date().toISOString();
    const attachmentId = randomUUID();
    await writeAttachmentFile(article.id, attachmentId, file.buffer);
    article.attachments.push({
      id: attachmentId,
      fileName: safeDownloadName(file.fileName),
      mimeType: mime,
      size: file.buffer.length,
      source: "upload",
      externalKey: null,
      sha256: hashBuffer(file.buffer),
      createdAt: now,
      createdBy: actor.name,
    });
    article.updatedAt = now;
    article.updatedBy = actor.name;
    await save();
    return article;
  });
}

export async function removeArticleAttachment(
  articleId: string,
  attachmentId: string,
  actor: KnowledgeActor,
): Promise<KnowledgeArticle> {
  if (!canEditKnowledge(actor.role)) throw new KnowledgeError("无权限", 403, "forbidden");
  return withKnowledgeData(async ({ data, save }) => {
    const article = data.articles.find((item) => item.id === articleId);
    if (!article) throw new KnowledgeError("找不到文档", 404, "not_found");
    const attachment = article.attachments.find((item) => item.id === attachmentId);
    if (!attachment) throw new KnowledgeError("找不到文件", 404, "not_found");
    article.attachments = article.attachments.filter((item) => item.id !== attachmentId);
    article.updatedAt = new Date().toISOString();
    article.updatedBy = actor.name;
    await save();
    await removeAttachmentFile(article.id, attachment.id);
    return article;
  });
}
