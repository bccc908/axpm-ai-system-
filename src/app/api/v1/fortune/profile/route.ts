import { NextResponse } from "next/server";
import { z } from "zod";
import { getChineseZodiac } from "@/lib/fortune/reading";
import { fortuneScopeForRole } from "@/lib/fortune/context";
import {
  getScopedFortuneProfile,
  saveScopedFortuneProfile,
} from "@/lib/fortune/context";
import { getFortuneSystems } from "@/lib/fortune/systems";
import { CustomerApiAuthError, resolveCustomerFromApiKey } from "@/lib/customer/api-auth";

const patchSchema = z.object({
  name: z.string().max(80).nullable().optional(),
  birth_date: z.string().max(20).nullable().optional(),
  birth_time: z.string().max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await resolveCustomerFromApiKey(request);
    const scope = fortuneScopeForRole(auth.user.id, auth.user.role);
    const profile = await getScopedFortuneProfile(scope);
    const locale = new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
    const zodiac = profile.birth_date ? getChineseZodiac(profile.birth_date, locale) : null;
    const systems = getFortuneSystems(profile, locale);
    return NextResponse.json({ profile, zodiac, systems });
  } catch (error) {
    if (error instanceof CustomerApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await resolveCustomerFromApiKey(request);
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const scope = fortuneScopeForRole(auth.user.id, auth.user.role);
    const profile = await saveScopedFortuneProfile(scope, parsed.data);
    const locale = new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
    const zodiac = profile.birth_date ? getChineseZodiac(profile.birth_date, locale) : null;
    const systems = getFortuneSystems(profile, locale);
    return NextResponse.json({ profile, zodiac, systems });
  } catch (error) {
    if (error instanceof CustomerApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
