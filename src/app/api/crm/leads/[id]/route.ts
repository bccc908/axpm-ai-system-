import { NextResponse } from "next/server";
import { z } from "zod";
import { getLeadDetail, updateLead } from "@/lib/crm/zoho-store";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  wechat: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  status: z.enum(["new", "contacted", "qualified", "unqualified", "converted"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  custom_fields: z.record(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  if (!detail) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const lead = await updateLead(id, parsed.data);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ lead: { ...lead, custom_fields: lead.custom_fields ?? {} } });
  } catch (error) {
    console.error("[CRM Lead PATCH]", error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}
