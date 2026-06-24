import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateMarketComparison,
  SAMPLE_COMPARISON,
} from "@/lib/ai/market-comparison";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.string().max(500).optional(),
  context: z.string().max(8000).optional(),
  useSample: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({
    ok: true,
    plan: SAMPLE_COMPARISON,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const topic =
      parsed.data.topic?.trim() ||
      (parsed.data.useSample ? SAMPLE_COMPARISON.title : "平台阶梯对比");

    const result = await generateMarketComparison(
      topic,
      parsed.data.context,
      parsed.data.useSample ? SAMPLE_COMPARISON : undefined,
    );

    await appendMarketDiaryEntry({
      question: parsed.data.useSample
        ? `[Sample 对比图] ${result.plan.title}`
        : `[生成对比图] ${topic}`,
      answer: `已生成《${result.plan.title}》，${result.columnCount} 列 · ${result.tierCount} 档 + 明细表 + CSV`,
      mode: "ppt",
    });

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      title: result.output.title,
      outputId: result.output.id,
      downloadUrl: result.downloadUrl,
      csvUrl: result.csvUrl,
      columnCount: result.columnCount,
      tierCount: result.tierCount,
      isSample: Boolean(parsed.data.useSample),
    });
  } catch (error) {
    console.error("[Market Generate Comparison]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Comparison generation failed" },
      { status: 500 },
    );
  }
}
