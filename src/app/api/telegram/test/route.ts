import { NextResponse } from "next/server";
import { z } from "zod";
import { testTelegramConnection } from "@/lib/integrations/telegram";

const schema = z.object({
  chatId: z.string().optional(),
});

export async function POST(request: Request) {
  let chatId: string | undefined;
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (parsed.success) chatId = parsed.data.chatId;
  } catch {
    // empty body is fine
  }

  const result = await testTelegramConnection(chatId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    bot: result.bot,
    message: `Test message sent via @${result.bot.username}`,
  });
}
