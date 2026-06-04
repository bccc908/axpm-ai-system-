import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/finance/constants";
import { deleteDebt, payDownDebt, updateDebt } from "@/lib/finance/store";

const schema = z.object({
  title: z.string().min(1).optional(),
  balance: z.number().min(0).optional(),
  minimum_payment: z.number().positive().nullable().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  category: z
    .enum(["credit_card", "bank_loan", "mortgage", "utility", "subscription", "insurance", "other"])
    .optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  interest_rate: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  pay_amount: z.number().positive().optional(),
  log_expense: z.boolean().optional(),
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

    if (parsed.data.pay_amount) {
      const result = await payDownDebt(id, parsed.data.pay_amount, {
        logExpense: parsed.data.log_expense ?? true,
      });
      if (!result) {
        return NextResponse.json({ error: "Debt not found" }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const { pay_amount: _p, log_expense: _l, ...patch } = parsed.data;
    void _p;
    void _l;
    const debt = await updateDebt(id, patch);
    if (!debt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }
    return NextResponse.json({ debt });
  } catch (error) {
    console.error("[Finance Debts PATCH]", error);
    return NextResponse.json({ error: "Failed to update debt" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteDebt(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
