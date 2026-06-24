import { NextResponse } from "next/server";
import { z } from "zod";
import { updateDeal } from "@/lib/crm/pro-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  probability: z.number().min(0).max(100).optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  close_date: z.string().nullable().optional(),
  stage_id: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const deal = await updateDeal(id, parsed.data);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (error) {
    console.error("[CRM Deals PATCH]", error);
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 });
  }
}
