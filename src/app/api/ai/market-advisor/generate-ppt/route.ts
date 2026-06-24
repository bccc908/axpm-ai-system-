import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMarketPpt } from "@/lib/ai/market-generate";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.string().min(1).max(500),
  context: z.string().max(8000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateMarketPpt(parsed.data.topic, parsed.data.context);
    const providerLabel =
      result.provider === "gamma" ? "Gamma" : "本地 PPT";
    const diaryExtra =
      result.provider === "gamma" && "gammaUrl" in result && result.gammaUrl
        ? `\n在线预览：${result.gammaUrl}`
        : "";
    await appendMarketDiaryEntry({
      question: `[生成 PPT] ${parsed.data.topic}`,
      answer: `已生成《${result.output.title}》（${providerLabel}），共 ${result.outline.slides.length} 页。下载：${result.downloadUrl}${diaryExtra}`,
      mode: "ppt",
    });
    return NextResponse.json({
      ok: true,
      title: result.output.title,
      outputId: result.output.id,
      downloadUrl: result.downloadUrl,
      slideCount: result.outline.slides.length,
      provider: result.provider,
      gammaUrl: "gammaUrl" in result ? result.gammaUrl : undefined,
    });
  } catch (error) {
    console.error("[Market Generate PPT]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PPT generation failed" },
      { status: 500 },
    );
  }
}
