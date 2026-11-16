import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { fetchEmXauPrints } from "@/lib/gold-signals/xau-tape";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const n = Number(new URL(request.url).searchParams.get("n"));
  const limit = Number.isFinite(n) ? Math.min(200, Math.max(40, Math.round(n))) : 150;
  try {
    const prints = await fetchEmXauPrints(limit);
    return NextResponse.json({ prints, as_of: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "tape fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
