import { telegramRequest } from "@/lib/integrations/telegram";
import {
  assertApproverChat,
  assertApproverChatIsPrivate,
  getApproverChatId,
  NotApproverChatError,
} from "./approver";
import { newPendingApproval, updateSignalApproval } from "./store";
import { ENGINE_LABEL, type SignalEngine } from "./types";

export const CALLBACK_PREFIX = "sa";

export function approvalCallbackData(action: "a" | "r", engine: SignalEngine, id: string) {
  return `${CALLBACK_PREFIX}:${action}:${engine}:${id}`; // <= 64 bytes for uuid ids
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function approvalHeader(engine: SignalEngine, id: string) {
  return [
    `<b>⏳ PENDING APPROVAL · ${escapeHtml(ENGINE_LABEL[engine])}</b>`,
    `Not sent to any client. Approve or reject below.`,
    `<code>${escapeHtml(engine)}:${escapeHtml(id.slice(0, 8))}</code>`,
    "",
  ].join("\n");
}

export type ApprovalDeliveryResult =
  | { ok: true; message_id: number; status: "pending" }
  | { ok: false; error: string };

/**
 * THE single path from any signal engine to Telegram.
 * - marks the stored signal pending
 * - sends ONLY to the approver's private chat, with Approve / Reject buttons
 * - records the Telegram message id (or the error) on the stored signal
 * There is no chat id parameter on purpose.
 */
export async function requestSignalApproval(params: {
  engine: SignalEngine;
  signalId: string;
  html: string;
}): Promise<ApprovalDeliveryResult> {
  const { engine, signalId, html } = params;

  const marked = await updateSignalApproval(engine, signalId, (cur) =>
    cur && cur.status !== "pending" ? cur : (cur ?? newPendingApproval()),
  );
  if (!marked) return { ok: false, error: `Signal ${engine}:${signalId} is not stored` };
  if (marked.status !== "pending") {
    return { ok: false, error: `Signal already ${marked.status}; not re-sending` };
  }

  const fail = async (error: string): Promise<ApprovalDeliveryResult> => {
    await updateSignalApproval(engine, signalId, (cur) => ({
      ...(cur ?? newPendingApproval()),
      delivery: { channel: "telegram", message_id: null, sent_at: null, error },
    }));
    return { ok: false, error };
  };

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return fail("TELEGRAM_BOT_TOKEN is not set");
  const approver = getApproverChatId();
  if (!approver) return fail("TELEGRAM_APPROVER_CHAT_ID / TELEGRAM_CHAT_ID is not set");

  let chatId: string;
  try {
    chatId = assertApproverChat(approver);
    await assertApproverChatIsPrivate(chatId);
  } catch (e) {
    return fail(e instanceof NotApproverChatError ? e.message : String(e));
  }

  const text = `${approvalHeader(engine, signalId)}${html}`.slice(0, 4000);
  const res = await telegramRequest<{ message_id: number; chat: { id: number } }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: approvalCallbackData("a", engine, signalId) },
          { text: "❌ Reject", callback_data: approvalCallbackData("r", engine, signalId) },
        ],
      ],
    },
  });
  if (!res.ok) return fail(res.error);

  const sentAt = new Date().toISOString();
  await updateSignalApproval(engine, signalId, (cur) => ({
    ...(cur ?? newPendingApproval()),
    delivery: { channel: "telegram", message_id: res.result.message_id, sent_at: sentAt, error: null },
  }));
  return { ok: true, message_id: res.result.message_id, status: "pending" };
}
