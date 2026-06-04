import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteClient, updateClient } from "@/lib/crm/store";

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  wechat: z.string().nullable().optional(),
  lead_status: z
    .enum(["new", "contacted", "qualified", "negotiating", "deposited", "active", "dormant", "lost"])
    .optional(),
  deposit_amount: z.number().optional(),
  deposit_currency: z.string().optional(),
  ib_source: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  next_follow_up_at: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const client = await updateClient(id, parsed.data);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (error) {
    console.error("[Clients PATCH]", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteClient(id);
    if (!deleted) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Clients DELETE]", error);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
