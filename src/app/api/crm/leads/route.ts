import { NextResponse } from "next/server";
import { z } from "zod";
import { createLead, listLeads } from "@/lib/crm/zoho-store";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  wechat: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  channel: z.enum(["whatsapp", "wechat", "telegram", "email", "phone", "web"]).nullable().optional(),
  status: z.enum(["new", "contacted", "qualified", "unqualified", "converted"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as "open" | null;
  const leads = await listLeads({ status: status ?? undefined });
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const lead = await createLead({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      wechat: parsed.data.wechat ?? null,
      company: parsed.data.company ?? null,
      title: parsed.data.title ?? null,
      source: parsed.data.source ?? null,
      channel: parsed.data.channel ?? null,
      status: parsed.data.status ?? "new",
      assigned_to: parsed.data.assigned_to ?? null,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("[CRM Leads POST]", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
