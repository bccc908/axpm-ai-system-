import { NextResponse } from "next/server";
import {
  getTelegramChatHints,
  sendTelegramMessage,
} from "@/lib/integrations/telegram";

/** Fetch new Telegram messages and reply with each user's Chat ID */
export async function POST() {
  try {
    const hintsResult = await getTelegramChatHints();

    if (!hintsResult.ok) {
      return NextResponse.json({ ok: false, error: hintsResult.error }, { status: 400 });
    }

    if (hintsResult.chats.length === 0) {
      return NextResponse.json({
        ok: false,
        error:
          "Telegram shows 0 messages to @assistants66bot. Open https://t.me/assistants66bot (exact bot), tap Start, send /start, then try again. Or use the manual Chat ID method below.",
        chats: [],
        botUsername: "assistants66bot",
      });
    }

    const replies: { chatId: string; sent: boolean }[] = [];

    for (const chat of hintsResult.chats) {
      const message = [
        "<b>AXPM AI Operations</b>",
        "",
        "Your Chat ID:",
        `<code>${chat.chatId}</code>`,
        "",
        "Add this to .env.local:",
        `TELEGRAM_CHAT_ID=${chat.chatId}`,
        "",
        "Then restart <code>npm run dev</code> and use Send test message on the dashboard.",
      ].join("\n");

      const result = await sendTelegramMessage(message, chat.chatId);
      replies.push({ chatId: chat.chatId, sent: result.ok });
    }

    return NextResponse.json({
      ok: true,
      chats: hintsResult.chats,
      replies,
      message: "Check Telegram — the bot should have sent you your Chat ID.",
    });
  } catch (error) {
    console.error("[Telegram Sync]", error);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 500 });
  }
}
