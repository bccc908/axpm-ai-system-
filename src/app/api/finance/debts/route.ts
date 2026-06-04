import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/finance/constants";
import { createDebt, listDebts } from "@/lib/finance/store";

const schema = z.object({
  title: z.string().min(1),
  balance: z.number().positive(),
  minimum_payment: z.number().positive().nullable().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).default(DEFAULT_CURRENCY),
  category: z
    .enum(["credit_card", "bank_loan", "mortgage", "utility", "subscription", "insurance", "other"])
    .default("bank_loan"),
  due_day: z.number().int().min(1).max(31).default(1),
  interest_rate: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  create_monthly_reminder: z.boolean().default(true),
});

export async function GET() {
  const debts = await listDebts();
  return NextResponse.json({ debts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const debt = await createDebt(
      {
        title: parsed.data.title,
        balance: parsed.data.balance,
        minimum_payment: parsed.data.minimum_payment ?? null,
        currency: parsed.data.currency,
        category: parsed.data.category,
        due_day: parsed.data.due_day,
        interest_rate: parsed.data.interest_rate ?? null,
        notes: parsed.data.notes ?? null,
      },
      { createMonthlyReminder: parsed.data.create_monthly_reminder },
    );

    return NextResponse.json({ debt }, { status: 201 });
  } catch (error) {
    console.error("[Finance Debts POST]", error);
    return NextResponse.json({ error: "Failed to create debt" }, { status: 500 });
  }
}
