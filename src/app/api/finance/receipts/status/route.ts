import { NextResponse } from "next/server";
import { getGoogleDriveConfig } from "@/lib/integrations/google-drive";
import { getLlmDisplayName, getLlmProvider, isLlmConfigured } from "@/lib/ai/llm-config";
import {
  getReceiptVisionLabel,
  isReceiptVisionConfigured,
  receiptVisionProviders,
} from "@/lib/ai/receipt-vision";

export async function GET() {
  const drive = getGoogleDriveConfig();
  const configured = isLlmConfigured();
  const visionConfigured = isReceiptVisionConfigured();
  return NextResponse.json({
    driveConfigured: drive.configured,
    openaiConfigured: configured,
    llmConfigured: configured,
    llmProvider: getLlmProvider(),
    llmLabel: getLlmDisplayName(),
    visionConfigured,
    visionProvider: visionConfigured ? getReceiptVisionLabel() : null,
    visionProviders: receiptVisionProviders(),
  });
}
