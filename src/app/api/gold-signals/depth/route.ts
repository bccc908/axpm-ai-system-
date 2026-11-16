import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { fetchGoldBookDepth, type GoldDepthSymbol } from "@/lib/gold-signals/xau-depth";

export const dynamic = "force-dynamic";

function parseSymbol(value: string | null): GoldDepthSymbol {
  return value?.toUpperCase() === "XAGUSDT" ? "XAGUSDT" : "XAUUSDT";
}

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const symbol = parseSymbol(new URL(request.url).searchParams.get("symbol"));
  try {
    const book = await fetchGoldBookDepth(symbol);
    if (!book) {
      return NextResponse.json({ error: "depth unavailable" }, { status: 502 });
    }
    return NextResponse.json(book);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "depth fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
