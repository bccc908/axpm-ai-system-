import { NextResponse } from "next/server";
import {
  getTelegramBotInfo,
  getTelegramChatHints,
  getTelegramConfig,
} from "@/lib/integrations/telegram";

export async function GET() {
  try {
    const config = getTelegramConfig();

    if (!config.hasToken) {
      return NextResponse.json({
        config,
        bot: null,
        chats: [],
        error: "Add TELEGRAM_BOT_TOKEN to .env.local and restart the dev server",
      });
    }

    const botResult = await getTelegramBotInfo();
    const chatsResult = await getTelegramChatHints();

    return NextResponse.json({
      config,
      bot: botResult.ok ? botResult.bot : null,
      botError: botResult.ok ? null : botResult.error,
      chats: chatsResult.ok ? chatsResult.chats : [],
      chatsError: chatsResult.ok
        ? chatsResult.chats.length === 0
          ? "Message your bot on Telegram first, then refresh to see your Chat ID"
          : null
        : chatsResult.error,
    });
  } catch (error) {
    console.error("[Telegram Status]", error);
    return NextResponse.json(
      { error: "Failed to check Telegram status" },
      { status: 500 },
    );
  }
}
