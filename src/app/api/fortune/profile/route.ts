import { NextResponse } from "next/server";
import { z } from "zod";
import { getChineseZodiac } from "@/lib/fortune/reading";
import { getServerSession } from "@/lib/auth/api-session";
import {
  fortuneScopeForRole,
  getScopedFortuneProfile,
  saveScopedFortuneProfile,
} from "@/lib/fortune/context";
import { getFortuneSystems } from "@/lib/fortune/systems";

const schema = z.object({
  name: z.string().max(80).nullable().optional(),
  birth_date: z.string().max(20).nullable().optional(),
  birth_time: z.string().max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const profile = await getScopedFortuneProfile(scope);
  const locale = new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
  const zodiac = profile.birth_date ? getChineseZodiac(profile.birth_date, locale) : null;
  const systems = getFortuneSystems(profile, locale);
  return NextResponse.json({ profile, zodiac, systems });
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
    const profile = await saveScopedFortuneProfile(scope, parsed.data);
    const locale =
      new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
    const zodiac = profile.birth_date ? getChineseZodiac(profile.birth_date, locale) : null;
    const systems = getFortuneSystems(profile, locale);
    return NextResponse.json({ profile, zodiac, systems });
  } catch (error) {
    console.error("[Fortune profile PATCH]", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
