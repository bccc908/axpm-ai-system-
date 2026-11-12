import { telegramRequest } from "@/lib/integrations/telegram";

/**
 * The ONLY chat signal messages may go to: Kayden's own private chat.
 * TELEGRAM_APPROVER_CHAT_ID wins; TELEGRAM_CHAT_ID is the fallback (today it is Kayden's DM).
 */
export function getApproverChatId(): string | null {
  const v =
    process.env.TELEGRAM_APPROVER_CHAT_ID?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || "";
  return v || null;
}

export class NotApproverChatError extends Error {}

/** Throws unless chatId is exactly the approver chat. */
export function assertApproverChat(chatId: string | number | null | undefined): string {
  const approver = getApproverChatId();
  if (!approver) throw new NotApproverChatError("Approver chat is not configured");
  if (chatId == null || String(chatId).trim() !== approver) {
    throw new NotApproverChatError("Refusing to send a signal to a chat that is not the approver");
  }
  return approver;
}

let privateCheck: { chatId: string; ok: boolean; at: number; error?: string } | null = null;
const PRIVATE_CHECK_MS = 10 * 60_000;

/** getChat must say type=private. Groups, supergroups and channels are refused. */
export async function assertApproverChatIsPrivate(chatId: string): Promise<void> {
  const now = Date.now();
  if (!privateCheck || privateCheck.chatId !== chatId || now - privateCheck.at > PRIVATE_CHECK_MS) {
    const res = await telegramRequest<{ type: string }>("getChat", { chat_id: chatId });
    privateCheck = res.ok
      ? { chatId, at: now, ok: res.result.type === "private", error: `chat type is ${res.result.type}` }
      : { chatId, at: now, ok: false, error: res.error };
    if (!res.ok) privateCheck.at = 0; // do not cache transport errors
  }
  if (!privateCheck.ok) {
    throw new NotApproverChatError(
      `Approver chat is not a private chat (${privateCheck.error ?? "unknown"}); refusing to send`,
    );
  }
}

export function resetApproverCheckCache() {
  privateCheck = null;
}
