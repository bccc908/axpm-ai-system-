import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/finance/store";

/** JSON metadata for a receipt (no file body). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await getReceipt(id);
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { receipt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
