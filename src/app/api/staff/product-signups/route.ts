import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { loadProductSignups } from "@/lib/customers/load-product-signups";
import { canViewProductSignups } from "@/lib/customers/product-signups";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewProductSignups(ctx.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await loadProductSignups();
  return NextResponse.json(list, {
    headers: { "cache-control": "private, no-store" },
  });
}
