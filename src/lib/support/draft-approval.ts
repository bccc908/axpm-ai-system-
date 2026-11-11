import "server-only";

import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { canDeliverDraftToClient } from "@/lib/support/client-send-gate";
import {
  createPendingReplyDraft,
  decideReplyDraft,
  markDraftNotified,
} from "@/lib/support/reply-drafts";
import type { Channel } from "@/types/database";
import type { ReplyDraft, ReplyDraftSource } from "@/types/reply-draft";

/**
 * Staff/approver chat only. Never a client chat id, never a guessed id.
 * Prefers TELEGRAM_APPROVER_CHAT_ID when set, otherwise TELEGRAM_CHAT_ID.
 */
export function getApproverTelegramChatId(): string | null {
  const approver = process.env.TELEGRAM_APPROVER_CHAT_ID?.trim();
  if (approver) return approver;
  const staff = process.env.TELEGRAM_CHAT_ID?.trim();
  return staff || null;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function formatDraftTelegramNotice(draft: ReplyDraft): string {
  const preview = draft.draftReply.trim().slice(0, 500);
  const question = draft.customerQuestion.trim().slice(0, 280);
  const url = `${appBaseUrl()}/dashboard/conversations#reply-drafts`;
  const provider = draft.fallback ? `${draft.provider} (fallback)` : draft.provider;
  return [
    "📝 <b>Pending reply draft</b> — review before anything is sent to a client",
    "",
    `<b>${escapeHtml(draft.clientName)}</b> · ${escapeHtml(draft.channel)} · ${escapeHtml(provider)}`,
    question ? `Question: 「${escapeHtml(question)}」` : "",
    "",
    `<b>Draft</b>`,
    escapeHtml(preview),
    "",
    `Status: pending approval`,
    `Id: <code>${escapeHtml(draft.id)}</code>`,
    "",
    `<a href="${url}">Open in CRM conversations →</a>`,
  ]
    .filter((line, i, arr) => line !== "" || (arr[i - 1] !== "" && i !== 0))
    .join("\n");
}

export async function notifyApproverOfDraft(draft: ReplyDraft): Promise<ReplyDraft> {
  const chatId = getApproverTelegramChatId();
  if (!chatId) {
    const updated = await markDraftNotified(draft.id, {
      ok: false,
      error: "no_approver_chat_id",
    });
    return updated ?? draft;
  }
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    const updated = await markDraftNotified(draft.id, {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not set",
    });
    return updated ?? draft;
  }

  const result = await sendTelegramMessage(formatDraftTelegramNotice(draft), chatId);
  const updated = await markDraftNotified(
    draft.id,
    result.ok ? { ok: true } : { ok: false, error: result.error },
  );
  return updated ?? draft;
}

export async function storePendingReplyDraft(input: {
  channel: Channel;
  clientName: string;
  clientId?: string | null;
  customerQuestion: string;
  conversationHistory?: string | null;
  replies: string[];
  provider?: string;
  fallback?: boolean;
  notice?: string | null;
  source: ReplyDraftSource;
  notify?: boolean;
}): Promise<ReplyDraft | null> {
  const [first, ...rest] = input.replies.map((r) => r.trim()).filter(Boolean);
  if (!first) return null;

  let draft = await createPendingReplyDraft({
    channel: input.channel,
    clientName: input.clientName,
    clientId: input.clientId,
    customerQuestion: input.customerQuestion,
    conversationHistory: input.conversationHistory,
    draftReply: first,
    alternatives: rest,
    provider: input.provider,
    fallback: input.fallback,
    notice: input.notice,
    source: input.source,
  });

  if (input.notify !== false) {
    draft = await notifyApproverOfDraft(draft);
  }
  return draft;
}

/**
 * Approve or reject only. This never delivers to WhatsApp, WeChat,
 * Telegram clients, or the website widget.
 */
export async function reviewReplyDraft(input: {
  id: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  decisionNote?: string | null;
}) {
  const result = await decideReplyDraft({
    id: input.id,
    status: input.decision,
    decidedBy: input.decidedBy,
    decisionNote: input.decisionNote,
  });
  if (!result.ok) return result;

  const deliveryAllowed = canDeliverDraftToClient({
    status: result.draft.status,
    channel: result.draft.channel,
  });
  return {
    ok: true as const,
    draft: result.draft,
    deliveredToClient: false,
    deliveryAllowed,
  };
}
