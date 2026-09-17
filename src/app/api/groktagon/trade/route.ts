import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import {
  kettAgentAddress,
  kettArmed,
  kettClose,
  kettOpen,
  KETT_MAX_BTC,
  KETT_MAX_ETH,
} from "@/lib/hyperliquid/trading";
import { loadGroktagonState } from "@/lib/groktagon/state";
import { resolveLiveBtcSetup, resolveLiveEthSetup } from "@/lib/groktagon/live-setup";

export const dynamic = "force-dynamic";

const Body = z.object({
  intent: z.enum(["close_btc", "open_btc", "close_eth", "open_eth"]),
  side: z.enum(["long", "short"]).optional(),
});

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({
    armed: kettArmed(),
    agent: kettAgentAddress(),
    max_btc: KETT_MAX_BTC,
    max_eth: KETT_MAX_ETH,
  });
}

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (!kettArmed()) {
    return NextResponse.json({ error: "agent key not configured" }, { status: 409 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid trade" }, { status: 400 });

  try {
    if (parsed.data.intent === "close_btc" || parsed.data.intent === "close_eth") {
      const result = await kettClose(parsed.data.intent === "close_eth" ? "ETH" : "BTC");
      const state = await loadGroktagonState();
      if (!result.ok) return NextResponse.json({ ...result, state }, { status: 409 });
      return NextResponse.json({ ...result, state, fired: true });
    }

    const coin = parsed.data.intent === "open_eth" ? "ETH" : "BTC";
    const setup = coin === "ETH" ? await resolveLiveEthSetup() : await resolveLiveBtcSetup();
    if (!setup.ok) {
      return NextResponse.json({ ok: false, error: setup.reason }, { status: 409 });
    }
    const side = parsed.data.side ?? setup.side;
    if (side !== setup.side) {
      return NextResponse.json(
        { ok: false, error: `live ${coin} setup is ${setup.side} · not ${side}` },
        { status: 409 },
      );
    }
    const result = await kettOpen(coin, setup.side, {
      source: setup.source,
      confidence: setup.confidence,
      created_at: setup.created_at,
      expires_at: setup.expires_at,
      entry_low: setup.entry_low,
      entry_high: setup.entry_high,
      stop_loss: setup.stop_loss,
      take_profit: setup.take_profit,
    });
    const state = await loadGroktagonState();
    if (!result.ok) return NextResponse.json({ ...result, state }, { status: 409 });
    return NextResponse.json({ ...result, state, fired: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "trade failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
