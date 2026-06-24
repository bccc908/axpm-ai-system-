import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { fortuneScopeForRole, listScopedFortuneReadings } from "@/lib/fortune/context";

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "200");
  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const readings = await listScopedFortuneReadings(scope, Number.isFinite(limit) ? limit : 200);
  return NextResponse.json({ readings });
}
