import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSocialMediaPack } from "@/lib/social/media-export";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const slideCardSchema = z.object({
  tag: z.string(),
  headline: z.string(),
  body: z.string(),
});

const schema = z.object({
  title: z.string().min(1),
  script: z.string().min(10),
  video: z.boolean().optional(),
  slideCards: z.array(slideCardSchema).optional(),
  narrationsZh: z.array(z.string().min(4)).max(5).optional(),
  mode: z.enum(["presenter", "slides", "auto"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateSocialMediaPack({
      title: parsed.data.title,
      script: parsed.data.script,
      slideCards: parsed.data.slideCards,
      narrationsZh: parsed.data.narrationsZh,
      includeVideo: parsed.data.video !== false,
      mode: parsed.data.mode ?? "auto",
    });

    if (!result.video) {
      return NextResponse.json({
        ...result,
        videoWarning:
          result.videoWarning ??
          "Slides ready. Video encode failed — download PNG slides or retry.",
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Social Media Generate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Media generation failed" },
      { status: 500 },
    );
  }
}
