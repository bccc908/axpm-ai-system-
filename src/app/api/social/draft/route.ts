import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSocialCopy } from "@/lib/ai/social-copy-generate";
import { resolveSocialPlatform } from "@/lib/ai/social-copy-prompt";

const schema = z.object({
  topic: z.string().min(1),
  locale: z.enum(["en", "zh", "both"]).optional(),
  platform: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  style: z.enum(["viral", "pro", "story"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { topic, locale = "both", platform, style } = parsed.data;
    const socialPlatform = resolveSocialPlatform(platform);

    const result = await generateSocialCopy({
      topic,
      locale,
      platform: socialPlatform,
      style: style ?? (socialPlatform === "douyin" ? "viral" : "pro"),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json(result.draft);
  } catch (error) {
    console.error("[Social Draft]", error);
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 });
  }
}
