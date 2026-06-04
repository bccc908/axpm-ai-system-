import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createTransaction,
  deleteReceipt,
  getReceipt,
  RECEIPTS_DIR,
  updateReceipt,
} from "@/lib/finance/store";
import { normalizeCurrency } from "@/lib/finance/helpers";

const patchSchema = z.object({
  merchant: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  receipt_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  create_expense: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await getReceipt(id);
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const filePath = path.join(RECEIPTS_DIR, receipt.filename);
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": receipt.mime_type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
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

    const current = await getReceipt(id);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let transaction_id = current.transaction_id;
    if (parsed.data.create_expense && !transaction_id) {
      const amount = parsed.data.amount ?? current.amount;
      if (amount && amount > 0) {
        const tx = await createTransaction({
          type: "expense",
          amount,
          currency: normalizeCurrency(parsed.data.currency ?? current.currency ?? "MYR"),
          category: parsed.data.category ?? current.category ?? "other",
          description: parsed.data.merchant ?? current.merchant ?? "Receipt expense",
          account: "cash",
          transaction_date:
            parsed.data.receipt_date ??
            current.receipt_date ??
            new Date().toISOString().split("T")[0],
        });
        transaction_id = tx.id;
      }
    }

    const receipt = await updateReceipt(id, {
      ...parsed.data,
      transaction_id,
    });

    return NextResponse.json({ receipt });
  } catch (error) {
    console.error("[Finance Receipt PATCH]", error);
    return NextResponse.json({ error: "Failed to update receipt" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteReceipt(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
