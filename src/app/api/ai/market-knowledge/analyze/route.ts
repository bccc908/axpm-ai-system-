import { NextResponse } from "next/server";
import { z } from "zod";
import { runMarketKnowledgeAnalysis } from "@/lib/ai/market-knowledge";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({ fileId: z.string().optional() });

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { listMarketKnowledgeFiles } = await import("@/lib/ai/market-knowledge");
    const files = await listMarketKnowledgeFiles();
    if (!files.length) {
      return NextResponse.json({ error: "No files to analyze" }, { status: 400 });
    }

    const fileId = parsed.data.fileId ?? files[0].id;
    const result = await runMarketKnowledgeAnalysis(fileId);

    await appendMarketDiaryEntry({
      question: `[文件分析] ${result.fileName}`,
      answer: result.analysis.summary,
      mode: result.category,
      fallback: result.analysis.fallback,
    });

    return NextResponse.json({
      ok: true,
      fileId: result.fileId,
      analysis: result.analysis,
    });
  } catch (error) {
    console.error("[Market Analyze]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
