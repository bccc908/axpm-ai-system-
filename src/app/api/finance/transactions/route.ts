import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/finance/constants";
import { createTransaction, listTransactions } from "@/lib/finance/store";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  currency: z.enum(SUPPORTED_CURRENCIES).default(DEFAULT_CURRENCY),
  category: z.string().min(1),
  description: z.string().default(""),
  account: z.string().default("cash"),
  transaction_date: z.string().optional(),
});

export async function GET() {
  const transactions = await listTransactions();
  return NextResponse.json({ transactions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const transaction = await createTransaction({
      type: parsed.data.type,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      category: parsed.data.category,
      description: parsed.data.description,
      account: parsed.data.account,
      transaction_date: parsed.data.transaction_date ?? new Date().toISOString().split("T")[0],
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("[Finance Transactions POST]", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
