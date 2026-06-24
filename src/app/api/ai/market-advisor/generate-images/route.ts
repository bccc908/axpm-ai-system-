import { NextResponse } from "next/server";
import { z } from "zod";
import { createMarketImagePreview } from "@/lib/ai/market-image-preview";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.string().min(1).max(500),
  context: z.string().max(8000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await createMarketImagePreview(parsed.data.topic, parsed.data.context);
    return NextResponse.json({
      ok: true,
      preview: true,
      previewId: result.previewId,
      title: result.title,
      images: result.images,
      slideCount: result.slideCount,
      provider: result.provider,
    });
  } catch (error) {
    console.error("[Market Generate Images Preview]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 },
    );
  }
}
