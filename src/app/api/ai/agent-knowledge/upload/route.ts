import { NextResponse } from "next/server";
import { addAgentKnowledgeFile, runKnowledgeAnalysis } from "@/lib/ai/agent-knowledge";
import { AGENT_KNOWLEDGE_MAX_BYTES } from "@/lib/ai/agent-knowledge-shared";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > AGENT_KNOWLEDGE_MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const entry = await addAgentKnowledgeFile({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    let analysis = null;
    let combinedAnalysis = null;
    try {
      const analyzed = await runKnowledgeAnalysis(entry.id);
      analysis = analyzed.analysis;
      combinedAnalysis = analyzed.combined;
    } catch (analyzeErr) {
      console.error("[Agent Knowledge Upload] analyze:", analyzeErr);
    }

    return NextResponse.json({
      file: {
        id: entry.id,
        name: entry.name,
        mimeType: entry.mimeType,
        size: entry.size,
        charCount: entry.charCount,
        uploaded_at: entry.uploaded_at,
        preview: entry.text.slice(0, 120),
        analysis,
      },
      combinedAnalysis,
    });
  } catch (error) {
    console.error("[Agent Knowledge Upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
