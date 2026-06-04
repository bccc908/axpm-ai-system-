import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, listClients } from "@/lib/crm/store";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  wechat: z.string().nullable().optional(),
  lead_status: z
    .enum(["new", "contacted", "qualified", "negotiating", "deposited", "active", "dormant", "lost"])
    .default("new"),
  deposit_amount: z.number().default(0),
  deposit_currency: z.string().default("USD"),
  ib_source: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  next_follow_up_at: z.string().nullable().optional(),
});

export async function GET() {
  const clients = await listClients();
  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const client = await createClient({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      wechat: parsed.data.wechat ?? null,
      lead_status: parsed.data.lead_status,
      deposit_amount: parsed.data.deposit_amount,
      deposit_currency: parsed.data.deposit_currency,
      ib_source: parsed.data.ib_source ?? null,
      tags: parsed.data.tags,
      assigned_to: parsed.data.assigned_to ?? null,
      notes: parsed.data.notes ?? null,
      next_follow_up_at: parsed.data.next_follow_up_at ?? null,
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("[Clients POST]", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
