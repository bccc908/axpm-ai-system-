import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { telegramRequest } from "@/lib/integrations/telegram";
import { getApproverChatId } from "./approver";
import { CALLBACK_PREFIX } from "./deliver";
import { getStoredSignal, updateSignalApproval } from "./store";
import { isSignalEngine, type ApprovalStatus, type SignalEngine } from "./types";

export type TelegramCallbackQuery = {
  id: string;
  from: { id: number; username?: string; first_name?: string; last_name?: string };
  message?: { message_id: number; chat: { id: number; type?: string } };
  data?: string;
};

export type CallbackOutcome =
  | { handled: true; engine: SignalEngine; id: string; status: ApprovalStatus; changed: boolean }
  | { handled: false; reason: string };

export function parseApprovalCallback(data: string | undefined) {
  const m = /^sa:(a|r):([a-z-]+):([A-Za-z0-9-]{1,64})$/.exec(data ?? "");
  if (!m || !isSignalEngine(m[2])) return null;
  return { action: m[1] === "a" ? ("approved" as const) : ("rejected" as const), engine: m[2], id: m[3] };
}

/**
 * Record Kayden's Approve / Reject tap. Only taps from the approver (private chat id == user id)
 * inside the approver chat count. Approving ONLY records state — nothing is sent to clients.
 */
export async function handleApprovalCallback(cb: TelegramCallbackQuery): Promise<CallbackOutcome> {
  const answer = (text: string) =>
    telegramRequest("answerCallbackQuery", { callback_query_id: cb.id, text }).catch(() => null);

  if (!cb.data?.startsWith(`${CALLBACK_PREFIX}:`)) return { handled: false, reason: "not an approval button" };
  const approver = getApproverChatId();
  if (!approver || String(cb.from.id) !== approver || String(cb.message?.chat.id) !== approver) {
    await answer("Not allowed");
    return { handled: false, reason: "not from the approver chat" };
  }
  const parsed = parseApprovalCallback(cb.data);
  if (!parsed) {
    await answer("Unknown button");
    return { handled: false, reason: "bad callback data" };
  }

  const row = await getStoredSignal(parsed.engine, parsed.id);
  if (!row) {
    await answer("Signal not found");
    return { handled: false, reason: "signal not found" };
  }

  let changed = false;
  const decidedAt = new Date().toISOString();
  const result = await updateSignalApproval(parsed.engine, parsed.id, (cur) => {
    if (!cur || cur.status !== "pending") return cur!; // decided already (or never requested)
    changed = true;
    return {
      ...cur,
      status: parsed.action,
      decided_at: decidedAt,
      decided_by: {
        telegram_user_id: cb.from.id,
        username: cb.from.username ?? null,
        name: [cb.from.first_name, cb.from.last_name].filter(Boolean).join(" ") || null,
      },
    };
  });
  if (!result) {
    await answer("Signal not pending");
    return { handled: false, reason: "no approval record" };
  }

  await answer(changed ? (result.status === "approved" ? "Approved ✅" : "Rejected ❌") : `Already ${result.status}`);
  if (cb.message) {
    const label = result.status === "approved" ? "✅ Approved" : "❌ Rejected";
    await telegramRequest("editMessageReplyMarkup", {
      chat_id: approver,
      message_id: cb.message.message_id,
      reply_markup: {
        inline_keyboard: [[{ text: `${label} · ${result.decided_at?.slice(0, 16)}Z`, callback_data: "sa:done" }]],
      },
    }).catch(() => null);
  }
  return { handled: true, engine: parsed.engine, id: parsed.id, status: result.status, changed };
}

type Update = { update_id: number; callback_query?: TelegramCallbackQuery };

function offsetPath() {
  return path.join(process.cwd(), "data", "telegram-approval-offset.json");
}

async function readOffset(): Promise<number | undefined> {
  try {
    const v = JSON.parse(await readFile(offsetPath(), "utf8")) as { offset?: number };
    return typeof v.offset === "number" ? v.offset : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Poll Telegram (getUpdates) for button taps. Chosen over a webhook: the server has no HTTPS
 * endpoint, and polling needs no public route, no secret header and no setWebhook call.
 */
export async function pollApprovalCallbacks() {
  const offset = await readOffset();
  const res = await telegramRequest<Update[]>("getUpdates", {
    offset,
    timeout: 0,
    limit: 100,
    allowed_updates: ["callback_query"],
  });
  if (!res.ok) {
    return {
      ok: false as const,
      error: res.error,
      error_code: res.error_code ?? null,
      description: res.description ?? null,
      http_status: res.http_status ?? null,
      attempts: res.attempts,
    };
  }

  const outcomes: CallbackOutcome[] = [];
  let next = offset;
  for (const u of res.result) {
    next = u.update_id + 1;
    if (u.callback_query) outcomes.push(await handleApprovalCallback(u.callback_query));
  }
  if (next !== offset && next !== undefined) {
    await mkdir(path.dirname(offsetPath()), { recursive: true });
    await writeFile(offsetPath(), JSON.stringify({ offset: next, updated_at: new Date().toISOString() }), "utf8");
  }
  return { ok: true as const, updates: res.result.length, outcomes };
}
