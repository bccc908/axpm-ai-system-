import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { KnowledgeAnalysis } from "@/lib/ai/analyze-knowledge";
import { AGENT_KNOWLEDGE_MAX_BYTES } from "@/lib/ai/agent-knowledge-shared";
import { isAllowedMarketFilename } from "@/lib/ai/market-knowledge-shared";

const DATA_FILE = path.join(process.cwd(), "data", "market-knowledge.json");
const FILES_DIR = path.join(process.cwd(), "data", "market-knowledge", "files");

export type MarketKnowledgeCategory = "market" | "data";

export type MarketKnowledgeEntry = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  text: string;
  charCount: number;
  category: MarketKnowledgeCategory;
  uploaded_at: string;
  storedFile?: string;
  analysis?: KnowledgeAnalysis;
};

type MarketKnowledgeStore = {
  files: MarketKnowledgeEntry[];
};

async function ensureStore(): Promise<MarketKnowledgeStore> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as MarketKnowledgeStore;
  } catch {
    return { files: [] };
  }
}

async function writeStore(store: MarketKnowledgeStore) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function safeStoredName(id: string, originalName: string) {
  const ext = path.extname(originalName).toLowerCase() || ".bin";
  return `${id}${ext}`;
}

export function getMarketKnowledgeFilePath(entry: MarketKnowledgeEntry) {
  if (!entry.storedFile) return null;
  return path.join(FILES_DIR, entry.storedFile);
}

export async function readMarketKnowledgeBinary(id: string) {
  const store = await ensureStore();
  const entry = store.files.find((f) => f.id === id);
  if (!entry?.storedFile) return null;
  const filePath = path.join(FILES_DIR, entry.storedFile);
  try {
    const buffer = await fs.readFile(filePath);
    return { entry, buffer, filePath };
  } catch {
    return null;
  }
}

export async function listMarketKnowledgeFiles(category?: MarketKnowledgeCategory) {
  const store = await ensureStore();
  const files = store.files.sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  );
  if (!category) return files;
  return files.filter((f) => f.category === category);
}

const OFFICE_EXTS = new Set([".pptx", ".xlsx", ".xls"]);

function officePlaceholder(name: string) {
  return `[已储存文件: ${name} — 可在列表中下载原文件。配置 UNSTRUCTURED_API_KEY 后可自动解析 PPT/Excel 文字]`;
}

async function extractText(buffer: Buffer, name: string, mimeType: string) {
  const ext = path.extname(name).toLowerCase();
  if (OFFICE_EXTS.has(ext)) {
    const { isMarketForceLocal } = await import("@/lib/local/self-hosted-config");
    if (!isMarketForceLocal()) {
      const { extractTextWithUnstructured, isUnstructuredConfigured } = await import(
        "@/lib/ai/unstructured-client"
      );
      if (isUnstructuredConfigured()) {
        const text = await extractTextWithUnstructured(buffer, name, mimeType);
        if (text) return text;
      }
    }
    return officePlaceholder(name);
  }
  const { extractDocumentText } = await import("@/lib/ai/extract-document");
  const { normalizeKnowledgeMimeType } = await import("@/lib/ai/agent-knowledge-shared");
  return extractDocumentText(buffer, name, normalizeKnowledgeMimeType(name, mimeType));
}

export async function refreshMarketFileTextFromBinary(id: string) {
  const read = await readMarketKnowledgeBinary(id);
  if (!read) return null;

  const ext = path.extname(read.entry.name).toLowerCase();
  if (!OFFICE_EXTS.has(ext)) return null;

  const { extractTextWithUnstructured, isUnstructuredConfigured } = await import(
    "@/lib/ai/unstructured-client"
  );
  if (!isUnstructuredConfigured()) return null;

  const text = await extractTextWithUnstructured(
    read.buffer,
    read.entry.name,
    read.entry.mimeType,
  );
  if (!text) return null;

  const store = await ensureStore();
  const file = store.files.find((f) => f.id === id);
  if (!file) return null;

  file.text = text;
  file.charCount = text.length;
  await writeStore(store);
  return file;
}

export async function addMarketKnowledgeFile(params: {
  name: string;
  mimeType: string;
  buffer: Buffer;
  category: MarketKnowledgeCategory;
}) {
  const { name, mimeType, buffer, category } = params;

  if (!isAllowedMarketFilename(name)) {
    throw new Error("Unsupported file type for Market AI storage.");
  }

  if (buffer.length > AGENT_KNOWLEDGE_MAX_BYTES) {
    throw new Error(`File too large (max ${AGENT_KNOWLEDGE_MAX_BYTES / 1024 / 1024}MB)`);
  }

  const { normalizeKnowledgeMimeType } = await import("@/lib/ai/agent-knowledge-shared");
  const normalizedMime = normalizeKnowledgeMimeType(name, mimeType);
  const text = await extractText(buffer, name, normalizedMime);
  const id = randomUUID();
  const storedFile = safeStoredName(id, name);

  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.writeFile(path.join(FILES_DIR, storedFile), buffer);

  const entry: MarketKnowledgeEntry = {
    id,
    name,
    mimeType: normalizedMime,
    size: buffer.length,
    text,
    charCount: text.length,
    category,
    uploaded_at: new Date().toISOString(),
    storedFile,
  };

  const store = await ensureStore();
  store.files.unshift(entry);
  await writeStore(store);
  return entry;
}

export async function addMarketKnowledgeText(params: {
  title: string;
  text: string;
  category: MarketKnowledgeCategory;
}) {
  const title = params.title.trim().slice(0, 120) || "粘贴资料";
  const text = params.text.trim();
  if (text.length < 20) {
    throw new Error("Text too short — paste at least 20 characters from the broker page.");
  }
  const buffer = Buffer.from(text, "utf-8");
  const safeName = `${title.replace(/[/\\?%*:|"<>]/g, "-")}.txt`;
  return addMarketKnowledgeFile({
    name: safeName,
    mimeType: "text/plain",
    buffer,
    category: params.category,
  });
}

export async function setMarketFileAnalysis(id: string, analysis: KnowledgeAnalysis) {
  const store = await ensureStore();
  const file = store.files.find((f) => f.id === id);
  if (!file) return null;
  file.analysis = analysis;
  await writeStore(store);
  return file;
}

export async function deleteMarketKnowledgeFile(id: string) {
  const store = await ensureStore();
  const entry = store.files.find((f) => f.id === id);
  if (!entry) return false;

  if (entry.storedFile) {
    await fs.unlink(path.join(FILES_DIR, entry.storedFile)).catch(() => undefined);
  }

  store.files = store.files.filter((f) => f.id !== id);
  await writeStore(store);
  return true;
}

const PROMPT_BUDGET = 90_000;

function isDataFile(name: string, mimeType: string) {
  const ext = path.extname(name).toLowerCase();
  return (
    ext === ".csv" ||
    ext === ".json" ||
    ext === ".xlsx" ||
    ext === ".xls" ||
    mimeType.includes("csv") ||
    mimeType.includes("json") ||
    mimeType.includes("spreadsheet")
  );
}

export function inferMarketCategory(name: string, mimeType: string): MarketKnowledgeCategory {
  return isDataFile(name, mimeType) ? "data" : "market";
}

export async function getMarketKnowledgeBrief(
  category?: MarketKnowledgeCategory | "all",
): Promise<string> {
  const files = await listMarketKnowledgeFiles(
    category && category !== "all" ? category : undefined,
  );

  const parts: string[] = [];
  let used = 0;

  for (const file of files) {
    const label =
      file.category === "data" ? `[Data file: ${file.name}]` : `[Market file: ${file.name}]`;
    const block = `${label}\n${file.text}`;
    if (used + block.length > PROMPT_BUDGET) {
      const room = PROMPT_BUDGET - used - 80;
      if (room > 200) {
        parts.push(`${block.slice(0, room)}\n[…file truncated]`);
      }
      break;
    }
    parts.push(block);
    used += block.length;
  }

  return parts.join("\n\n");
}

export async function runMarketKnowledgeAnalysis(fileId: string) {
  const { analyzeMarketFile } = await import("@/lib/ai/analyze-market-knowledge");
  const files = await listMarketKnowledgeFiles();
  let file = files.find((f) => f.id === fileId);
  if (!file) throw new Error("File not found");

  if (file.text.startsWith("[已储存文件:")) {
    const refreshed = await refreshMarketFileTextFromBinary(fileId);
    if (refreshed) file = refreshed;
  }

  const analysis = await analyzeMarketFile(file.name, file.text, file.category);
  await setMarketFileAnalysis(fileId, analysis);
  return { fileId, analysis, fileName: file.name, category: file.category };
}
