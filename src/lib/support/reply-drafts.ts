import "server-only";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { Channel } from "@/types/database";
import type {
  ReplyDraft,
  ReplyDraftData,
  ReplyDraftSource,
  ReplyDraftStatus,
} from "@/types/reply-draft";

export function getReplyDraftsFile() {
  return (
    process.env.AXPM_REPLY_DRAFTS_FILE?.trim() ||
    path.join(process.cwd(), "data", "reply-drafts.json")
  );
}

async function ensureFile() {
  const file = getReplyDraftsFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify({ drafts: [] } satisfies ReplyDraftData, null, 2));
  }
}

async function readData(): Promise<ReplyDraftData> {
  await ensureFile();
  const raw = await fs.readFile(getReplyDraftsFile(), "utf-8");
  const parsed = JSON.parse(raw) as Partial<ReplyDraftData>;
  return { drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [] };
}

async function writeData(data: ReplyDraftData) {
  await ensureFile();
  await fs.writeFile(getReplyDraftsFile(), JSON.stringify(data, null, 2));
}

export async function listReplyDrafts(filters?: {
  status?: ReplyDraftStatus;
  clientId?: string;
}) {
  const data = await readData();
  let drafts = [...data.drafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters?.status) {
    drafts = drafts.filter((d) => d.status === filters.status);
  }
  if (filters?.clientId) {
    drafts = drafts.filter((d) => d.clientId === filters.clientId);
  }
  return drafts;
}

export async function getReplyDraft(id: string) {
  const data = await readData();
  return data.drafts.find((d) => d.id === id) ?? null;
}

export async function createPendingReplyDraft(input: {
  channel: Channel;
  clientName: string;
  clientId?: string | null;
  customerQuestion: string;
  conversationHistory?: string | null;
  draftReply: string;
  alternatives?: string[];
  provider?: string;
  fallback?: boolean;
  notice?: string | null;
  source: ReplyDraftSource;
}): Promise<ReplyDraft> {
  const draftReply = input.draftReply.trim();
  if (!draftReply) {
    throw new Error("Draft reply is empty");
  }
  const now = new Date().toISOString();
  const draft: ReplyDraft = {
    id: randomUUID(),
    status: "pending_approval",
    channel: input.channel,
    clientName: input.clientName.trim() || "Unknown",
    clientId: input.clientId?.trim() || null,
    customerQuestion: input.customerQuestion.trim(),
    conversationHistory: input.conversationHistory?.trim() || null,
    draftReply,
    alternatives: (input.alternatives ?? []).map((a) => a.trim()).filter(Boolean),
    provider: input.provider ?? "unknown",
    fallback: Boolean(input.fallback),
    notice: input.notice ?? null,
    source: input.source,
    notifiedTelegram: false,
    telegramError: null,
    createdAt: now,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  };

  const data = await readData();
  data.drafts.unshift(draft);
  await writeData(data);
  return draft;
}

export async function markDraftNotified(
  id: string,
  result: { ok: true } | { ok: false; error: string },
) {
  const data = await readData();
  const draft = data.drafts.find((d) => d.id === id);
  if (!draft) return null;
  draft.notifiedTelegram = result.ok;
  draft.telegramError = result.ok ? null : result.error;
  await writeData(data);
  return draft;
}

export async function decideReplyDraft(input: {
  id: string;
  status: Extract<ReplyDraftStatus, "approved" | "rejected">;
  decidedBy: string;
  decisionNote?: string | null;
}): Promise<
  | { ok: true; draft: ReplyDraft }
  | { ok: false; error: string; status?: number }
> {
  const data = await readData();
  const draft = data.drafts.find((d) => d.id === input.id);
  if (!draft) {
    return { ok: false, error: "Draft not found", status: 404 };
  }
  if (draft.status !== "pending_approval") {
    return { ok: false, error: `Draft is already ${draft.status}`, status: 409 };
  }
  draft.status = input.status;
  draft.decidedAt = new Date().toISOString();
  draft.decidedBy = input.decidedBy.trim() || "unknown";
  draft.decisionNote = input.decisionNote?.trim() || null;
  await writeData(data);
  return { ok: true, draft };
}
