import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { loadGroktagonState } from "@/lib/groktagon/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  try {
    const state = await loadGroktagonState();
    return NextResponse.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "groktagon failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
