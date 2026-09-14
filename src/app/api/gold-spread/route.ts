import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { listGoldSpreadSignals } from "@/lib/gold-spread/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const limit = Math.min(
    50,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? "20")),
  );
  const signals = await listGoldSpreadSignals(limit);
  return NextResponse.json({ signals });
}
