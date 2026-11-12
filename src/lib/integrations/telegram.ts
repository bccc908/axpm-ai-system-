const TELEGRAM_API = "https://api.telegram.org";

export type TelegramConfig = {
  hasToken: boolean;
  hasChatId: boolean;
  isReady: boolean;
};

export type TelegramBotInfo = {
  id: number;
  username: string;
  first_name: string;
};

export type TelegramChatHint = {
  chatId: string;
  type: string;
  title?: string;
  username?: string;
  firstName?: string;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
};

/** A failed Bot API call. `error` is always safe to log: the bot token is redacted. */
export type TelegramRequestError = {
  ok: false;
  error: string;
  /** Telegram's own error_code (e.g. 409, 429, 502), when it sent one. */
  error_code?: number;
  /** Telegram's own description, redacted. */
  description?: string;
  /** HTTP status of the reply; undefined when no reply arrived (network error or timeout). */
  http_status?: number;
  /** How many HTTP attempts were made (1 or 2). */
  attempts: number;
};

export type TelegramRequestOptions = {
  /** Retry once on 5xx / 429 / network / timeout. Default: only for read-only methods. */
  retry?: boolean;
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number;
};

export const TELEGRAM_TIMEOUT_MS = 10_000;
export const TELEGRAM_RETRY_DELAY_MS = 2_000;
/** A retry_after above this is capped: the cron tick runs again in a minute anyway. */
export const TELEGRAM_MAX_RETRY_AFTER_MS = 5_000;

/**
 * Methods that are safe to repeat. Sending methods are not retried, so a reply lost after
 * Telegram accepted it can never deliver a message twice.
 */
const RETRY_BY_DEFAULT = new Set(["getUpdates", "getMe", "getChat"]);

const TOKEN_IN_TEXT = /bot\d+:[A-Za-z0-9_-]+/g;

/** Remove the bot token (and any `bot<id>:<secret>` URL part) from text before it is logged or returned. */
export function redactTelegramSecrets(text: string): string {
  let out = text.replace(TOKEN_IN_TEXT, "bot<redacted>");
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (token && token.length >= 6) out = out.split(token).join("<redacted>");
  return out;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Attempt<T> =
  | { kind: "ok"; result: T }
  | { kind: "fail"; retryable: boolean; delayMs: number; error: Omit<TelegramRequestError, "attempts"> };

async function attemptTelegram<T>(
  url: string,
  body: Record<string, unknown> | undefined,
  timeoutMs: number,
): Promise<Attempt<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    const msg = timedOut
      ? `timed out after ${timeoutMs / 1000}s`
      : redactTelegramSecrets(error instanceof Error ? error.message : "Network error");
    return {
      kind: "fail",
      retryable: true,
      delayMs: TELEGRAM_RETRY_DELAY_MS,
      error: { ok: false, error: `Cannot reach Telegram (${msg}). Check internet or VPN.` },
    };
  }

  const text = await res.text().catch(() => "");
  let data: TelegramApiResponse<T> | null = null;
  try {
    data = JSON.parse(text) as TelegramApiResponse<T>;
  } catch {
    data = null;
  }

  if (data?.ok && res.ok) return { kind: "ok", result: data.result as T };

  const code = typeof data?.error_code === "number" ? data.error_code : res.status;
  const description = data?.description
    ? redactTelegramSecrets(data.description)
    : data
      ? undefined
      : `non-JSON reply: ${redactTelegramSecrets(text.replace(/\s+/g, " ").trim()).slice(0, 200)}`;
  const retryable = code === 429 || code >= 500 || res.status === 429 || res.status >= 500;
  const retryAfter = data?.parameters?.retry_after;
  const delayMs =
    code === 429 && typeof retryAfter === "number" && retryAfter > 0
      ? Math.min(retryAfter * 1000, TELEGRAM_MAX_RETRY_AFTER_MS)
      : TELEGRAM_RETRY_DELAY_MS;
  return {
    kind: "fail",
    retryable,
    delayMs,
    error: {
      ok: false,
      error: description ?? `Telegram API error (${res.status})`,
      error_code: code,
      description,
      http_status: res.status,
    },
  };
}

/** Low-level Bot API call. Signal code must not call this directly — use @/lib/signal-approval. */
export async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>,
  options: TelegramRequestOptions = {},
): Promise<{ ok: true; result: T } | TelegramRequestError> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set in .env.local", attempts: 0 };
  }
  const url = `${TELEGRAM_API}/bot${token}/${method}`;
  const timeoutMs = options.timeoutMs ?? TELEGRAM_TIMEOUT_MS;
  const maxAttempts = (options.retry ?? RETRY_BY_DEFAULT.has(method)) ? 2 : 1;

  for (let attempt = 1; ; attempt++) {
    const r = await attemptTelegram<T>(url, body, timeoutMs);
    if (r.kind === "ok") return { ok: true, result: r.result };
    // Never retry 409 (another getUpdates consumer / webhook set) or any other 4xx except 429.
    if (!r.retryable || attempt >= maxAttempts) return { ...r.error, attempts: attempt };
    await sleep(r.delayMs);
  }
}

export function getTelegramConfig(): TelegramConfig {
  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const hasChatId = Boolean(process.env.TELEGRAM_CHAT_ID?.trim());
  return { hasToken, hasChatId, isReady: hasToken && hasChatId };
}

export async function getTelegramBotInfo(): Promise<
  { ok: true; bot: TelegramBotInfo } | { ok: false; error: string }
> {
  const result = await telegramRequest<{
    id: number;
    username: string;
    first_name: string;
  }>("getMe");

  if (!result.ok) return result;

  return {
    ok: true,
    bot: {
      id: result.result.id,
      username: result.result.username,
      first_name: result.result.first_name,
    },
  };
}

type TelegramUpdate = {
  message?: {
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      first_name?: string;
    };
  };
};

/** Recent chats from users who messaged the bot — use to find TELEGRAM_CHAT_ID */
export async function getTelegramChatHints(): Promise<
  { ok: true; chats: TelegramChatHint[] } | { ok: false; error: string }
> {
  const result = await telegramRequest<TelegramUpdate[]>("getUpdates", {
    limit: 100,
    allowed_updates: ["message"],
  });

  if (!result.ok) return result;

  const seen = new Set<string>();
  const chats: TelegramChatHint[] = [];
  const updates = Array.isArray(result.result) ? result.result : [];

  for (const update of updates) {
    const chat = update.message?.chat;
    if (!chat) continue;

    const chatId = String(chat.id);
    if (seen.has(chatId)) continue;
    seen.add(chatId);

    chats.push({
      chatId,
      type: chat.type,
      title: chat.title,
      username: chat.username,
      firstName: chat.first_name,
    });
  }

  return { ok: true, chats };
}

export async function sendTelegramMessage(
  message: string,
  chatId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId ?? process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" };
  }
  if (!targetChatId) {
    return { ok: false, error: "TELEGRAM_CHAT_ID is not set" };
  }

  const result = await telegramRequest<{ message_id: number }>("sendMessage", {
    chat_id: targetChatId,
    text: message,
    parse_mode: "HTML",
  });

  if (!result.ok) return result;
  return { ok: true };
}

export async function testTelegramConnection(chatId?: string): Promise<
  | { ok: true; bot: TelegramBotInfo; messageId: number }
  | { ok: false; error: string }
> {
  const botResult = await getTelegramBotInfo();
  if (!botResult.ok) return botResult;

  const targetChatId = chatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();
  if (!targetChatId) {
    return {
      ok: false,
      error:
        "No Chat ID. Message @assistants66bot and tap Start, or paste your ID below.",
    };
  }

  const message = [
    "<b>AXPM AI Operations</b>",
    "",
    "Telegram is connected successfully.",
    `Bot: @${botResult.bot.username}`,
    `Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" })}`,
  ].join("\n");

  const sendResult = await sendTelegramMessage(message, targetChatId);
  if (!sendResult.ok) return sendResult;

  return { ok: true, bot: botResult.bot, messageId: 0 };
}

export function formatFollowUpReminder(params: {
  clientName: string;
  dueAt: string;
  notes?: string | null;
}): string {
  return [
    "<b>AXPM Follow-Up Reminder</b>",
    "",
    `Client: <b>${params.clientName}</b>`,
    `Due: ${params.dueAt}`,
    params.notes ? `Notes: ${params.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
