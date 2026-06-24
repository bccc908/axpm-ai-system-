import { NextResponse } from "next/server";
import {
  clearMarketChatMessages,
  listMarketChatMessages,
  replaceMarketChatMessages,
} from "@/lib/ai/market-chat-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const messages = await listMarketChatMessages();
  return NextResponse.json(
    { messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: { role: "user" | "assistant"; content: string; mode?: string; fallback?: boolean }[];
      clear?: boolean;
    };

    if (body.clear) {
      await clearMarketChatMessages();
      return NextResponse.json({ ok: true, messages: [] });
    }

    if (Array.isArray(body.messages)) {
      const messages = await replaceMarketChatMessages(body.messages);
      return NextResponse.json({ ok: true, messages });
    }

    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  } catch (error) {
    console.error("[Market Chat History]", error);
    return NextResponse.json({ error: "Failed to save chat" }, { status: 500 });
  }
}

export async function DELETE() {
  await clearMarketChatMessages();
  return NextResponse.json({ ok: true });
}
