import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/finance/constants";
import { createPaymentReminder, listPaymentReminders } from "@/lib/finance/store";

const schema = z.object({
  title: z.string().min(1),
  amount: z.number().positive().nullable().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).default(DEFAULT_CURRENCY),
  due_day: z.number().int().min(1).max(31),
  category: z
    .enum(["credit_card", "bank_loan", "mortgage", "utility", "subscription", "insurance", "other"])
    .default("other"),
  notes: z.string().nullable().optional(),
  remind_days_before: z.number().int().min(0).max(30).default(3),
  is_active: z.boolean().default(true),
  debt_id: z.string().uuid().nullable().optional(),
  auto_deduct_monthly: z.boolean().default(true),
});

export async function GET() {
  const payments = await listPaymentReminders();
  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payment = await createPaymentReminder({
      title: parsed.data.title,
      amount: parsed.data.amount ?? null,
      currency: parsed.data.currency,
      due_day: parsed.data.due_day,
      category: parsed.data.category,
      notes: parsed.data.notes ?? null,
      remind_days_before: parsed.data.remind_days_before,
      is_active: parsed.data.is_active,
      debt_id: parsed.data.debt_id ?? null,
      auto_deduct_monthly: parsed.data.auto_deduct_monthly,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error("[Finance Payments POST]", error);
    return NextResponse.json({ error: "Failed to create payment reminder" }, { status: 500 });
  }
}
