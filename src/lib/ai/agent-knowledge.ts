import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { readAppSettings } from "@/lib/finance/settings";
import type { KnowledgeAnalysis } from "@/lib/ai/analyze-knowledge";
import {
  AGENT_KNOWLEDGE_MAX_BYTES,
  isAllowedKnowledgeFilename,
  normalizeKnowledgeMimeType,
} from "@/lib/ai/agent-knowledge-shared";

const DATA_FILE = path.join(process.cwd(), "data", "reply-agent-knowledge.json");

export type AgentKnowledgeEntry = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  text: string;
  charCount: number;
  uploaded_at: string;
  analysis?: KnowledgeAnalysis;
};

type KnowledgeStore = {
  files: AgentKnowledgeEntry[];
  combinedAnalysis?: KnowledgeAnalysis;
};

async function ensureStore(): Promise<KnowledgeStore> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as KnowledgeStore;
  } catch {
    return { files: [] };
  }
}

async function writeStore(store: KnowledgeStore) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

export async function listAgentKnowledgeFiles() {
  const store = await ensureStore();
  return store.files.sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  );
}

export async function addAgentKnowledgeFile(params: {
  name: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const { name, mimeType, buffer } = params;

  if (!isAllowedKnowledgeFilename(name)) {
    throw new Error(
      "Unsupported file type. Upload documents (.txt, .md, .pdf, .docx, .rtf) or images (.png, .jpg).",
    );
  }

  if (buffer.length > AGENT_KNOWLEDGE_MAX_BYTES) {
    throw new Error(`File too large (max ${AGENT_KNOWLEDGE_MAX_BYTES / 1024 / 1024}MB)`);
  }

  const normalizedMime = normalizeKnowledgeMimeType(name, mimeType);
  const { extractDocumentText } = await import("@/lib/ai/extract-document");
  const text = await extractDocumentText(buffer, name, normalizedMime);
  const entry: AgentKnowledgeEntry = {
    id: randomUUID(),
    name,
    mimeType: normalizedMime,
    size: buffer.length,
    text,
    charCount: text.length,
    uploaded_at: new Date().toISOString(),
  };

  const store = await ensureStore();
  store.files.unshift(entry);
  await writeStore(store);
  return entry;
}

export async function setFileAnalysis(id: string, analysis: KnowledgeAnalysis) {
  const store = await ensureStore();
  const file = store.files.find((f) => f.id === id);
  if (!file) return null;
  file.analysis = analysis;
  await writeStore(store);
  return file;
}

export async function setCombinedAnalysis(analysis: KnowledgeAnalysis) {
  const store = await ensureStore();
  store.combinedAnalysis = analysis;
  await writeStore(store);
  return analysis;
}

export async function getCombinedAnalysis() {
  const store = await ensureStore();
  return store.combinedAnalysis ?? null;
}

export async function runKnowledgeAnalysis(fileId?: string) {
  const settings = await readAppSettings();
  const manual = settings.replyAgentPrompt?.trim() ?? "";
  const { analyzeKnowledgeFile, analyzeAllKnowledgeFiles } = await import(
    "@/lib/ai/analyze-knowledge"
  );

  const files = await listAgentKnowledgeFiles();
  if (files.length === 0) {
    throw new Error("No training files to analyze");
  }

  if (fileId) {
    const file = files.find((f) => f.id === fileId);
    if (!file) throw new Error("File not found");
    const analysis = await analyzeKnowledgeFile(file, manual);
    await setFileAnalysis(fileId, analysis);
    const combined = await analyzeAllKnowledgeFiles(
      await listAgentKnowledgeFiles(),
      manual,
    );
    await setCombinedAnalysis(combined);
    return { fileId, analysis, combined };
  }

  for (const file of files) {
    const analysis = await analyzeKnowledgeFile(file, manual);
    await setFileAnalysis(file.id, analysis);
  }
  const combined = await analyzeAllKnowledgeFiles(
    await listAgentKnowledgeFiles(),
    manual,
  );
  await setCombinedAnalysis(combined);
  return { analysis: combined, files: await listAgentKnowledgeFiles() };
}

export async function deleteAgentKnowledgeFile(id: string) {
  const store = await ensureStore();
  const before = store.files.length;
  store.files = store.files.filter((f) => f.id !== id);
  if (store.files.length === before) return false;
  await writeStore(store);
  return true;
}

const PROMPT_BUDGET = 80_000;

/** Manual instructions + uploaded file text for the reply agent */
export async function getAgentTrainingBrief(): Promise<string> {
  const settings = await readAppSettings();
  const manual = settings.replyAgentPrompt?.trim() ?? "";
  const files = await listAgentKnowledgeFiles();

  const parts: string[] = [];
  if (manual) parts.push(manual);

  let used = manual.length;
  for (const file of files) {
    const block = `--- Knowledge file: ${file.name} ---\n${file.text}`;
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
