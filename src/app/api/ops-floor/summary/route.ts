import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { emptyOpsFloorSummary } from "@/lib/ops-floor/build-summary";
import { loadOpsFloorSummary } from "@/lib/ops-floor/load-summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only rollup for the AXPM ops floor. Missing data files become empty defaults. */
export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleCanAccessModule(ctx.user.role, "ops")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await loadOpsFloorSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("ops-floor summary failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(emptyOpsFloorSummary());
  }
}
