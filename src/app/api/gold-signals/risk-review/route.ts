import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { runAndStoreGoldSignalRiskReview } from "@/lib/gold-signals/risk-review/review";
import { getGoldSignalById } from "@/lib/gold-signals/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function authorize() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET ?id=<signalId> — stored review for a signal (null if none yet). */
export async function GET(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const signal = await getGoldSignalById(id);
  if (!signal) return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  return NextResponse.json({ review: signal.risk_review ?? null });
}

const bodySchema = z.object({
  signal_id: z.string().min(1),
  force: z.boolean().optional(),
  locale: z.enum(["en", "zh"]).optional(),
});

/** POST { signal_id, force?, locale? } — run (or return cached) review and store it. */
export async function POST(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const result = await runAndStoreGoldSignalRiskReview(parsed.data.signal_id, {
      force: parsed.data.force,
      locale: parsed.data.locale,
    });
    if (!result) return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Risk review failed" },
      { status: 500 },
    );
  }
}
