import { NextResponse } from "next/server";
import {
  addMarketKnowledgeFile,
  inferMarketCategory,
  runMarketKnowledgeAnalysis,
} from "@/lib/ai/market-knowledge";
import { appendMarketDiaryEntry } from "@/lib/ai/market-diary";
import { AGENT_KNOWLEDGE_MAX_BYTES } from "@/lib/ai/agent-knowledge-shared";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const categoryRaw = formData.get("category");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > AGENT_KNOWLEDGE_MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const category =
      categoryRaw === "market" || categoryRaw === "data"
        ? categoryRaw
        : inferMarketCategory(file.name, file.type || "application/octet-stream");

    const buffer = Buffer.from(await file.arrayBuffer());
    const entry = await addMarketKnowledgeFile({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      category,
    });

    let analysis = null;
    try {
      const analyzed = await runMarketKnowledgeAnalysis(entry.id);
      analysis = analyzed.analysis;
      await appendMarketDiaryEntry({
        question: `[文件分析] ${entry.name}`,
        answer: analysis.summary,
        mode: entry.category,
        fallback: analysis.fallback,
      });
    } catch (analyzeErr) {
      console.error("[Market Knowledge Upload] analyze:", analyzeErr);
    }

    return NextResponse.json({
      file: {
        id: entry.id,
        name: entry.name,
        mimeType: entry.mimeType,
        size: entry.size,
        charCount: entry.charCount,
        category: entry.category,
        uploaded_at: entry.uploaded_at,
        preview: entry.text.slice(0, 120),
        analysis,
      },
    });
  } catch (error) {
    console.error("[Market Knowledge Upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
