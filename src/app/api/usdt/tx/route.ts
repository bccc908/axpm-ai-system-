import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { lookupUsdtQuery } from "@/lib/finance/usdt-lookup";

export const dynamic = "force-dynamic";

async function handle(hash: string | null) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "finance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hash?.trim()) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }
  const data = await lookupUsdtQuery(hash);
  if (!data.result && data.transfers.length === 0 && data.balances.length === 0) {
    return NextResponse.json(
      { error: "not_found", result: null, transfers: [], balances: [], kind: data.kind },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}

export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get("hash") ?? new URL(request.url).searchParams.get("q");
  return handle(hash);
}

export async function POST(request: Request) {
  let hash: string | null = null;
  try {
    const body = (await request.json()) as { hash?: string; q?: string };
    hash = body.hash ?? body.q ?? null;
  } catch {
    hash = null;
  }
  return handle(hash);
}
