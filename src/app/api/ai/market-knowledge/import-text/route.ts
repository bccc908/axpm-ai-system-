import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addMarketKnowledgeText,
  runMarketKnowledgeAnalysis,
  type MarketKnowledgeCategory,
} from "@/lib/ai/market-knowledge";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(120),
  text: z.string().min(20).max(200_000),
  category: z.enum(["market", "data"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const category = (parsed.data.category ?? "market") as MarketKnowledgeCategory;
    const entry = await addMarketKnowledgeText({
      title: parsed.data.title,
      text: parsed.data.text,
      category,
    });

    let analysis = null;
    try {
      const analyzed = await runMarketKnowledgeAnalysis(entry.id);
      analysis = analyzed.analysis;
      await appendMarketDiaryEntry({
        question: `[粘贴资料] ${entry.name}`,
        answer: analysis.summary,
        mode: entry.category,
        fallback: analysis.fallback,
      });
    } catch (analyzeErr) {
      console.error("[Market Knowledge Import Text] analyze:", analyzeErr);
    }

    return NextResponse.json({
      file: {
        id: entry.id,
        name: entry.name,
        size: entry.size,
        charCount: entry.charCount,
        category: entry.category,
        uploaded_at: entry.uploaded_at,
        preview: entry.text.slice(0, 120),
        analysis,
      },
    });
  } catch (error) {
    console.error("[Market Knowledge Import Text]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
