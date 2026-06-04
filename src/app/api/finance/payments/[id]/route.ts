import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/finance/constants";
import {
  deletePaymentReminder,
  markPaymentPaid,
  updatePaymentReminder,
} from "@/lib/finance/store";

const schema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().positive().nullable().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  category: z
    .enum(["credit_card", "bank_loan", "mortgage", "utility", "subscription", "insurance", "other"])
    .optional(),
  notes: z.string().nullable().optional(),
  remind_days_before: z.number().int().min(0).max(30).optional(),
  is_active: z.boolean().optional(),
  mark_paid: z.boolean().optional(),
  pay_amount: z.number().positive().optional(),
  log_expense: z.boolean().optional(),
  debt_id: z.string().uuid().nullable().optional(),
  auto_deduct_monthly: z.boolean().optional(),
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

    if (parsed.data.mark_paid) {
      const result = await markPaymentPaid(id, {
        amount: parsed.data.pay_amount,
        logExpense: parsed.data.log_expense,
      });
      if (!result) {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const {
      mark_paid: _markPaid,
      pay_amount: _pay,
      log_expense: _log,
      ...patch
    } = parsed.data;
    void _markPaid;
    void _pay;
    void _log;
    const payment = await updatePaymentReminder(id, patch);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error) {
    console.error("[Finance Payments PATCH]", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deletePaymentReminder(id);
    if (!deleted) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Finance Payments DELETE]", error);
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
  }
}
