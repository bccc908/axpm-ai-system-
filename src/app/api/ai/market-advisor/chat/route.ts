import { NextResponse } from "next/server";
import { z } from "zod";
import { chatMarketAdvisor } from "@/lib/ai/market-advisor";
import { appendMarketChatMessages } from "@/lib/ai/market-chat-store";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["market", "data", "copy"]),
  message: z.string().min(1).max(8000),
  useSearch: z.boolean().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await chatMarketAdvisor({
      mode: parsed.data.mode,
      message: parsed.data.message,
      history: parsed.data.history,
      useSearch: parsed.data.useSearch,
    });

    await appendMarketChatMessages([
      { role: "user", content: parsed.data.message, mode: parsed.data.mode },
      {
        role: "assistant",
        content: result.content,
        mode: parsed.data.mode,
        fallback: result.fallback,
      },
    ]);

    await appendMarketDiaryEntry({
      question: parsed.data.message,
      answer: result.content,
      mode: parsed.data.mode,
      fallback: result.fallback,
    });

    return NextResponse.json({
      ok: true,
      content: result.content,
      fallback: result.fallback ?? false,
      notice: result.notice,
      searchUsed: result.searchUsed ?? false,
      searchQuery: result.searchQuery,
      searchSources: result.searchSources,
      searchMode: result.searchMode,
      searchReasonZh: result.searchReasonZh,
      searchReasonEn: result.searchReasonEn,
    });
  } catch (error) {
    console.error("[Market Advisor Chat]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 },
    );
  }
}
