import { NextResponse } from "next/server";
import { z } from "zod";
import {
  normalizeProvider,
  saveEmailSettings,
} from "@/lib/integrations/email/settings";

const schema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["qq", "163", "126", "aliyun", "gmail", "outlook", "custom"]).optional(),
  customHost: z.string().optional(),
  customPort: z.number().int().min(1).max(65535).optional(),
  customSecure: z.boolean().optional(),
  fromName: z.string().min(1).optional(),
  recipients: z.array(z.string().email()).optional(),
  ccRecipients: z.array(z.string().email()).optional(),
  locale: z.enum(["en", "zh", "both"]).optional(),
  timezone: z.enum(["Asia/Kuala_Lumpur", "Asia/Shanghai", "Asia/Hong_Kong"]).optional(),
  auto: z
    .object({
      dailyDigest: z.boolean().optional(),
      dailyFortune: z.boolean().optional(),
      paymentReminders: z.boolean().optional(),
      clientFollowUps: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = { ...parsed.data };
    if (patch.provider) {
      patch.provider = normalizeProvider(patch.provider);
    }

    const settings = await saveEmailSettings(patch);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[Email Settings PATCH]", error);
    return NextResponse.json({ error: "Failed to save email settings" }, { status: 500 });
  }
}
