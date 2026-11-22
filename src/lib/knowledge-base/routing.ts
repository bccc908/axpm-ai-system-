import {
  KNOWLEDGE_SECTIONS,
  isKnowledgeSection,
  type KnowledgeSectionId,
} from "@/lib/knowledge-base/sections";

const ALIASES: Record<KnowledgeSectionId, string[]> = {
  company_policy: ["company policy", "company_policy", "公司政策", "政策", "policy"],
  product_trading: ["product and trading", "product trading", "product_trading", "产品与交易", "产品", "交易", "trading"],
  customer_support: ["customer support", "customer_support", "客户支持", "客服", "support", "kyc"],
  compliance_risk: ["compliance and risk", "compliance risk", "compliance_risk", "合规与风控", "合规", "风控", "compliance", "risk"],
  operations: ["operations", "运营流程", "运营", "ops", "sop"],
  brand_marketing: ["brand and marketing", "brand marketing", "brand_marketing", "品牌与市场", "品牌", "市场", "brand", "marketing"],
};

function normalizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function segmentMatches(segment: string, alias: string): boolean {
  const left = normalizeSegment(segment);
  const right = normalizeSegment(alias);
  if (!left || !right) return false;
  if (left === right) return true;
  if (/[\u3400-\u9fff]/.test(right) && right.length >= 2 && left.includes(right)) return true;
  if (right.length >= 3 && new RegExp(`(?:^|\\s)${escapeRegExp(right)}(?:$|\\s)`).test(left)) return true;
  return false;
}

function sectionFromSegment(segment: string): KnowledgeSectionId | null {
  let best: { id: KnowledgeSectionId; length: number } | null = null;
  for (const section of KNOWLEDGE_SECTIONS) {
    if (segment.trim() === section.id) return section.id;
    for (const alias of ALIASES[section.id]) {
      if (!segmentMatches(segment, alias)) continue;
      const length = normalizeSegment(alias).length;
      if (!best || length > best.length) best = { id: section.id, length };
    }
  }
  return best?.id ?? null;
}

/** Suggest one of the six sections from a folder path, file name, or note title. */
export function inferKnowledgeSection(...inputs: Array<string | null | undefined>): KnowledgeSectionId | null {
  const segments: string[] = [];
  for (const input of inputs) {
    if (!input?.trim()) continue;
    const parts = input
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => part.replace(/\.[^.]+$/, "").trim())
      .filter(Boolean);
    segments.push(...parts);
  }
  if (segments.length === 0) return null;
  const directories = segments.slice(0, -1);
  for (let index = directories.length - 1; index >= 0; index -= 1) {
    const match = sectionFromSegment(directories[index] ?? "");
    if (match) return match;
  }
  return sectionFromSegment(segments[segments.length - 1] ?? "");
}

export function titleFromFilename(name: string): string {
  const base = (name.split(/[/\\]/).pop() ?? name).replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return (base || "Imported document").slice(0, 180);
}

export function splitMarkdownNote(raw: string): { title: string | null; section: string | null; body: string } {
  let body = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  let title: string | null = null;
  let section: string | null = null;
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---\n", 4);
    if (end > 0) {
      const yaml = body.slice(4, end);
      body = body.slice(end + 5).trim();
      for (const line of yaml.split("\n")) {
        const match = /^(title|section):\s*(.+?)\s*$/i.exec(line);
        if (!match?.[1] || !match[2]) continue;
        const value = match[2].replace(/^["']|["']$/g, "").trim();
        if (match[1].toLowerCase() === "title") title = value;
        else section = value;
      }
    }
  }
  const first = body.split("\n")[0] ?? "";
  const heading = /^#\s+(.+?)\s*$/.exec(first);
  if (!title && heading?.[1]) {
    title = heading[1].trim();
    body = body.split("\n").slice(1).join("\n").trim();
  }
  if (section && !isKnowledgeSection(section)) {
    section = inferKnowledgeSection(section);
  }
  return { title, section, body };
}

export function resolveImportSection(
  chosen: string | null | undefined,
  ...hints: Array<string | null | undefined>
): KnowledgeSectionId | null {
  if (chosen && isKnowledgeSection(chosen)) return chosen;
  const fromHints = inferKnowledgeSection(...hints);
  if (fromHints) return fromHints;
  const noteSection = hints
    .map((hint) => (hint ? splitMarkdownNote(hint).section : null))
    .find((value): value is string => Boolean(value));
  if (noteSection && isKnowledgeSection(noteSection)) return noteSection;
  return null;
}
