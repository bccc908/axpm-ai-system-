import { NextResponse } from "next/server";
import { z } from "zod";
import { createDeal, listDeals } from "@/lib/crm/pro-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  amount: z.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  source: z.string().max(120).nullable().optional(),
  stage_id: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? undefined;
  const status = url.searchParams.get("status") as "open" | "won" | "lost" | null;
  const deals = await listDeals({
    client_id: clientId ?? undefined,
    status: status ?? undefined,
  });
  return NextResponse.json({ deals });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const deal = await createDeal(parsed.data);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    console.error("[CRM Deals POST]", error);
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}
