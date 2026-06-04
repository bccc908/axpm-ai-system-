import { NextResponse } from "next/server";
import { getGoogleDriveConfig } from "@/lib/integrations/google-drive";
import { getLlmDisplayName, getLlmProvider, isLlmConfigured } from "@/lib/ai/llm-config";

export async function GET() {
  const drive = getGoogleDriveConfig();
  const configured = isLlmConfigured();
  return NextResponse.json({
    driveConfigured: drive.configured,
    openaiConfigured: configured,
    llmConfigured: configured,
    llmProvider: getLlmProvider(),
    llmLabel: getLlmDisplayName(),
  });
}
