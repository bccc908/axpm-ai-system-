import { NextResponse } from "next/server";
import { z } from "zod";
import { readAppSettings, writeAppSettings } from "@/lib/finance/settings";
import {
  DEFAULT_EDGE_VOICE,
  DEFAULT_MAC_VOICE,
  EDGE_VOICES,
  MAC_VOICES,
} from "@/lib/social/presenter-voices";

export const dynamic = "force-dynamic";

const edgeIds = EDGE_VOICES.map((v) => v.id);
const macIds = MAC_VOICES.map((v) => v.id);

const schema = z.object({
  edgeVoice: z.enum(edgeIds as [string, ...string[]]).optional(),
  macVoice: z.enum(macIds as [string, ...string[]]).optional(),
  ttsPriority: z.enum(["edge", "mac", "auto"]).optional(),
});

export async function GET() {
  const settings = await readAppSettings();
  return NextResponse.json(
    {
      edgeVoice: settings.presenterEdgeVoice ?? DEFAULT_EDGE_VOICE,
      macVoice: settings.presenterMacVoice ?? DEFAULT_MAC_VOICE,
      ttsPriority: settings.presenterTtsPriority ?? (process.platform === "darwin" ? "mac" : "auto"),
      edgeVoices: EDGE_VOICES,
      macVoices: MAC_VOICES,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const patch: Parameters<typeof writeAppSettings>[0] = {};
    if (parsed.data.edgeVoice !== undefined) patch.presenterEdgeVoice = parsed.data.edgeVoice;
    if (parsed.data.macVoice !== undefined) patch.presenterMacVoice = parsed.data.macVoice;
    if (parsed.data.ttsPriority !== undefined) patch.presenterTtsPriority = parsed.data.ttsPriority;
    const settings = await writeAppSettings(patch);
    return NextResponse.json(
      {
        edgeVoice: settings.presenterEdgeVoice ?? DEFAULT_EDGE_VOICE,
        macVoice: settings.presenterMacVoice ?? DEFAULT_MAC_VOICE,
        ttsPriority: settings.presenterTtsPriority ?? (process.platform === "darwin" ? "mac" : "auto"),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Presenter Settings]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return PATCH(request);
}
