import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import {
  fortuneScopeForRole,
  getScopedFortuneReadingById,
  isScopedReadingShareUnlocked,
  unlockScopedReadingForShare,
} from "@/lib/fortune/context";
import { buildFortuneSharePayload, shareRequiredForFollowUp } from "@/lib/fortune/share-gate";
import { ensureFortuneShareToken } from "@/lib/fortune/public-share";

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const readingId = new URL(request.url).searchParams.get("readingId");
  if (!readingId) {
    return NextResponse.json({ error: "Missing readingId" }, { status: 400 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const reading = await getScopedFortuneReadingById(scope, readingId);
  if (!reading) {
    return NextResponse.json({ error: "Reading not found" }, { status: 404 });
  }

  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "zh";
  const required = shareRequiredForFollowUp(ctx.user.role);
  const exempt = !required;
  const unlocked = await isScopedReadingShareUnlocked(scope, readingId);
  const effectiveUnlocked = unlocked || exempt;
  const shareToken = await ensureFortuneShareToken(scope.userId, readingId, ctx.user.id);
  const share = buildFortuneSharePayload(reading, locale, ctx.user.id, shareToken);

  return NextResponse.json({
    required,
    exempt,
    unlocked: effectiveUnlocked,
    share,
  });
}

const bodySchema = z.object({
  readingId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const reading = await getScopedFortuneReadingById(scope, parsed.data.readingId);
  if (!reading) {
    return NextResponse.json({ error: "Reading not found" }, { status: 404 });
  }

  if (!shareRequiredForFollowUp(ctx.user.role)) {
    await unlockScopedReadingForShare(scope, parsed.data.readingId);
    return NextResponse.json({ ok: true, unlocked: true, skipped: true });
  }

  await unlockScopedReadingForShare(scope, parsed.data.readingId);
  return NextResponse.json({ ok: true, unlocked: true });
}
