import { NextResponse } from "next/server";
import { z } from "zod";
import { openAiErrorMessage } from "@/lib/ai/client";
import { runKnowledgeAnalysis } from "@/lib/ai/agent-knowledge";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const schema = z.object({
  fileId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await runKnowledgeAnalysis(parsed.data.fileId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Agent Knowledge Analyze]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : openAiErrorMessage(error) },
      { status: 400 },
    );
  }
}
