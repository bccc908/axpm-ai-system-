import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMarketChartPpt } from "@/lib/ai/market-charts";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const maxDuration = 120;
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

    const result = await generateMarketChartPpt(parsed.data.topic, parsed.data.context);

    await appendMarketDiaryEntry({
      question: `[生成数据图表 PPT] ${parsed.data.topic}`,
      answer: `已生成《${result.output.title}》，含 ${result.chartCount} 张专业图表 + CSV 数据。PPT：${result.downloadUrl}`,
      mode: "ppt",
    });

    return NextResponse.json({
      ok: true,
      title: result.output.title,
      outputId: result.output.id,
      downloadUrl: result.downloadUrl,
      csvUrl: result.csvUrl,
      chartCount: result.chartCount,
      slideCount: result.slideCount,
      provider: result.provider,
    });
  } catch (error) {
    console.error("[Market Generate Chart PPT]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chart PPT generation failed" },
      { status: 500 },
    );
  }
}
