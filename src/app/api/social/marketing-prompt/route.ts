import { NextResponse } from "next/server";
import { z } from "zod";
import { readAppSettings, writeAppSettings } from "@/lib/finance/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readAppSettings();
  return NextResponse.json(
    { prompt: settings.socialMarketingPrompt ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const schema = z.object({
  prompt: z.string().max(20_000),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors.prompt?.[0] ??
        "Prompt too long (max 20000 characters)";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const trimmed = parsed.data.prompt.trim();
    const settings = await writeAppSettings({
      socialMarketingPrompt: trimmed || null,
    });
    return NextResponse.json(
      { prompt: settings.socialMarketingPrompt ?? "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Social Marketing Prompt]", error);
    const msg = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return PATCH(request);
}
