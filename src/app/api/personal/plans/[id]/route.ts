import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePlan, updatePlan } from "@/lib/personal/store";

const planItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
});

const schema = z.object({
  title: z.string().min(1).optional(),
  period: z.enum(["daily", "weekly"]).optional(),
  plan_date: z.string().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(planItemSchema).optional(),
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

    const plan = await updatePlan(id, parsed.data);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[Personal Plans PATCH]", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deletePlan(id);
    if (!deleted) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Personal Plans DELETE]", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
