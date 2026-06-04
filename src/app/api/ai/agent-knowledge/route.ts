import { NextResponse } from "next/server";
import {
  getAgentTrainingBrief,
  getCombinedAnalysis,
  listAgentKnowledgeFiles,
} from "@/lib/ai/agent-knowledge";
import { getCachedOpenAIReachable } from "@/lib/ai/openai-reachable";
import { isLlmConfigured } from "@/lib/ai/llm-config";

export async function GET() {
  const files = await listAgentKnowledgeFiles();
  const briefLength = (await getAgentTrainingBrief()).length;
  const combinedAnalysis = await getCombinedAnalysis();
  const configured = isLlmConfigured();
  const cachedReachable = getCachedOpenAIReachable();
  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      charCount: f.charCount,
      uploaded_at: f.uploaded_at,
      preview: f.text.slice(0, 120),
      analysis: f.analysis ?? null,
    })),
    combinedAnalysis,
    briefLength,
    openai: {
      configured,
      reachable: cachedReachable ?? false,
      ready: configured && (cachedReachable ?? false),
      statusPending: configured && cachedReachable === null,
    },
  });
}
