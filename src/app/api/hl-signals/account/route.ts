import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { fetchHlAccount } from "@/lib/hyperliquid/account";
import { isHlAddress, normalizeHlAddress } from "@/lib/hyperliquid/client";
import { getHyperliquidAddress, saveHyperliquidAddress } from "@/lib/hyperliquid/settings";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  address: z
    .string()
    .trim()
    .refine((v) => v === "" || isHlAddress(v), "invalid address"),
});

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const address = await getHyperliquidAddress();
  if (!address) {
    return NextResponse.json({ address: null, account: null });
  }

  try {
    const account = await fetchHlAccount(address);
    return NextResponse.json({ address, account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "account fetch failed";
    return NextResponse.json({ address, account: null, error: msg }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "地址无效" }, { status: 400 });

  const saved = await saveHyperliquidAddress(
    parsed.data.address ? normalizeHlAddress(parsed.data.address) : null,
  );
  if (!saved) return NextResponse.json({ address: null, account: null });

  try {
    const account = await fetchHlAccount(saved);
    return NextResponse.json({ address: saved, account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "account fetch failed";
    return NextResponse.json({ address: saved, account: null, error: msg }, { status: 502 });
  }
}
