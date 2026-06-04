import { NextResponse } from "next/server";
import { deleteTransaction } from "@/lib/finance/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteTransaction(id);
    if (!deleted) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Finance Transactions DELETE]", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
