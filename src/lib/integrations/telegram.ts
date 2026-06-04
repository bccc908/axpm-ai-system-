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
  description?: string;
};

async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set in .env.local" };
  }

  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Network error";
    return {
      ok: false,
      error: `Cannot reach Telegram (${msg}). Check internet or VPN.`,
    };
  }

  const data = (await res.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    return { ok: false, error: data.description ?? `Telegram API error (${res.status})` };
  }

  return { ok: true, result: data.result as T };
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
