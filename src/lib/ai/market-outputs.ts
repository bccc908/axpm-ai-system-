import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const OUTPUT_ROOT = path.join(process.cwd(), "data", "market-outputs");
const INDEX_FILE = path.join(OUTPUT_ROOT, "index.json");

export type MarketOutputKind = "ppt" | "image";

export type MarketOutputEntry = {
  id: string;
  kind: MarketOutputKind;
  title: string;
  files: string[];
  created_at: string;
};

type OutputIndex = { outputs: MarketOutputEntry[] };

async function ensureIndex(): Promise<OutputIndex> {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(INDEX_FILE, "utf-8")) as OutputIndex;
  } catch {
    return { outputs: [] };
  }
}

async function writeIndex(index: OutputIndex) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export function marketOutputDir(id: string) {
  return path.join(OUTPUT_ROOT, id);
}

export async function listMarketOutputs(limit = 20) {
  const index = await ensureIndex();
  return index.outputs
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function registerMarketOutput(params: {
  kind: MarketOutputKind;
  title: string;
  files?: string[];
}) {
  const id = randomUUID().slice(0, 12);
  const dir = marketOutputDir(id);
  await fs.mkdir(dir, { recursive: true });

  const entry: MarketOutputEntry = {
    id,
    kind: params.kind,
    title: params.title,
    files: params.files ?? [],
    created_at: new Date().toISOString(),
  };

  const index = await ensureIndex();
  index.outputs.unshift(entry);
  if (index.outputs.length > 50) index.outputs = index.outputs.slice(0, 50);
  await writeIndex(index);
  return entry;
}

export async function updateMarketOutputFiles(id: string, files: string[]) {
  const index = await ensureIndex();
  const entry = index.outputs.find((o) => o.id === id);
  if (!entry) return null;
  entry.files = files;
  await writeIndex(index);
  return entry;
}

export async function getMarketOutput(id: string) {
  const index = await ensureIndex();
  return index.outputs.find((o) => o.id === id) ?? null;
}

export function marketOutputFilePath(outputId: string, filename: string) {
  const safe = path.basename(filename);
  return path.join(marketOutputDir(outputId), safe);
}

export function marketOutputFileUrl(outputId: string, filename: string) {
  return `/api/ai/market-advisor/outputs/${outputId}/${encodeURIComponent(filename)}`;
}
