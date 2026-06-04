import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlan, listPlans } from "@/lib/personal/store";

const planItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
});

const schema = z.object({
  title: z.string().min(1),
  period: z.enum(["daily", "weekly"]).default("daily"),
  plan_date: z.string(),
  notes: z.string().nullable().optional(),
  items: z.array(planItemSchema).optional(),
});

export async function GET() {
  const plans = await listPlans();
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const plan = await createPlan({
      title: parsed.data.title,
      period: parsed.data.period,
      plan_date: parsed.data.plan_date,
      notes: parsed.data.notes ?? null,
      items: parsed.data.items,
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("[Personal Plans POST]", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
