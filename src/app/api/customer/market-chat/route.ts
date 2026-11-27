import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import {
  appendCustomerMarketPrompt,
  listCustomerMarketMessages,
  type CustomerMarketMode,
} from "@/lib/ai/customer-market-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["market", "data", "copy"]),
  message: z.string().trim().min(1).max(2000),
});

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.user.role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const messages = await listCustomerMarketMessages(ctx.user.id);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.user.role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const messages = await appendCustomerMarketPrompt({
    userId: ctx.user.id,
    message: parsed.data.message,
    mode: parsed.data.mode as CustomerMarketMode,
  });

  return NextResponse.json({
    ok: true,
    live: false,
    messages,
  });
}
