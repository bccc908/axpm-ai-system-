import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { decideGroktagonTicket } from "@/lib/groktagon/tickets";
import { loadGroktagonState } from "@/lib/groktagon/state";
import { kettArmed, kettOpenBtc } from "@/lib/hyperliquid/trading";

export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "hold"]),
});

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid ticket" }, { status: 400 });
  }

  const ticket = await decideGroktagonTicket(
    parsed.data.id,
    parsed.data.action === "approve" ? "approved" : "held",
  );
  if (!ticket) {
    return NextResponse.json({ error: "ticket not pending" }, { status: 409 });
  }

  let fired = false;
  let fire_detail: string | null = null;
  if (
    parsed.data.action === "approve" &&
    kettArmed() &&
    (ticket.source === "btc" || ticket.source === "hl") &&
    (ticket.bias === "long" || ticket.bias === "short")
  ) {
    try {
      const result = await kettOpenBtc(ticket.bias, {
        source: ticket.source,
        confidence: ticket.confidence,
        created_at: ticket.created_at,
        expires_at: ticket.expires_at,
        entry_low: ticket.entry_low,
        entry_high: ticket.entry_high,
        stop_loss: ticket.stop_loss,
        take_profit: ticket.take_profit,
      });
      fired = result.ok;
      fire_detail = result.ok ? result.detail : result.error;
    } catch (e) {
      fire_detail = e instanceof Error ? e.message : "trade failed";
    }
  }

  const state = await loadGroktagonState();
  return NextResponse.json({ ticket, state, fired, fire_detail });
}
