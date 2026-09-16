import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { scanReceipt } from "@/lib/ai/receipt-scan";
import { isReceiptVisionConfigured, getReceiptVisionLabel } from "@/lib/ai/receipt-vision";
import { getReceipt, RECEIPTS_DIR } from "@/lib/finance/store";

/** Re-run AI OCR on an existing receipt file — results go to the edit form; user saves to persist. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const current = await getReceipt(id);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isReceiptVisionConfigured() && !process.env.DEEPSEEK_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "AI not configured — set OPENROUTER_API_KEY or DEEPSEEK_API_KEY" },
        { status: 503 },
      );
    }

    const filePath = path.join(RECEIPTS_DIR, current.filename);
    const buffer = await fs.readFile(filePath);
    const scan = await scanReceipt(buffer, current.mime_type, current.filename);

    return NextResponse.json({
      receipt: current,
      scan: scan.data,
      scanError: scan.scanError ?? null,
      visionProvider: scan.visionProvider ?? getReceiptVisionLabel(),
    });
  } catch (error) {
    console.error("[Finance Receipt rescan]", error);
    return NextResponse.json({ error: "AI rescan failed" }, { status: 500 });
  }
}
