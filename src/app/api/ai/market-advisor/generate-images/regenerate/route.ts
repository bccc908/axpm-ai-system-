import { NextResponse } from "next/server";
import { z } from "zod";
import { regenerateMarketPreviewSlide } from "@/lib/ai/market-image-preview";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  previewId: z.string().min(4).max(40),
  slideIndex: z.number().int().min(0).max(20),
  editNote: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await regenerateMarketPreviewSlide(
      parsed.data.previewId,
      parsed.data.slideIndex,
      parsed.data.editNote,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Market Regenerate Image]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regenerate failed" },
      { status: 500 },
    );
  }
}
