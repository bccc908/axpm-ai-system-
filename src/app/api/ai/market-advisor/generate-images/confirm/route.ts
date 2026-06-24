import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmMarketImagePreview } from "@/lib/ai/market-image-preview";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const dynamic = "force-dynamic";

const schema = z.object({
  previewId: z.string().min(4).max(40),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await confirmMarketImagePreview(parsed.data.previewId);
    await appendMarketDiaryEntry({
      question: `[生成配图] ${result.title}`,
      answer: `已保存《${result.title}》，共 ${result.slideCount} 张 PNG。`,
      mode: "image",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Market Confirm Images]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 },
    );
  }
}
