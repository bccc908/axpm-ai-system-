import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { scanReceipt } from "@/lib/ai/receipt-scan";
import { uploadReceiptToGoogleDrive } from "@/lib/integrations/google-drive";
import {
  createReceipt,
  createTransaction,
  ensureReceiptsDir,
  listReceipts,
  RECEIPTS_DIR,
} from "@/lib/finance/store";
import { normalizeCurrency } from "@/lib/finance/helpers";
import {
  isAllowedReceiptMime,
  normalizeReceiptMime,
  receiptExtension,
} from "@/lib/finance/receipt-files";
import fs from "fs/promises";

export async function GET() {
  const receipts = await listReceipts();
  return NextResponse.json(
    { receipts },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const autoExpense = form.get("auto_expense") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mimeType = normalizeReceiptMime(file.type || "image/jpeg", file.name);
    if (!isAllowedReceiptMime(mimeType, file.name)) {
      return NextResponse.json(
        { error: "Only images and PDF files are supported" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = receiptExtension(mimeType, file.name);
    const filename = `${randomUUID()}.${ext}`;

    await ensureReceiptsDir();
    await fs.writeFile(path.join(RECEIPTS_DIR, filename), buffer);

    let scanData: {
      merchant: string | null;
      amount: number | null;
      currency: string | null;
      category: string | null;
      receipt_date: string | null;
      notes: string | null;
    };
    let scanError: string | null = null;
    let visionProvider: string | null = null;
    try {
      const scan = await scanReceipt(buffer, mimeType, file.name);
      scanData = scan.data;
      scanError = scan.scanError ?? null;
      visionProvider = scan.visionProvider ?? null;
    } catch (error) {
      console.error("[Finance Receipts] scan error:", error);
      scanData = {
        merchant: null,
        amount: null,
        currency: null,
        category: null,
        receipt_date: null,
        notes: "Scan failed — edit amount manually",
      };
      scanError = error instanceof Error ? error.message : "Scan failed";
    }

    let google_drive_file_id: string | null = null;
    let google_drive_url: string | null = null;
    const driveName = scanData.merchant
      ? `${scanData.receipt_date ?? "receipt"}-${scanData.merchant}.${ext}`
      : filename;
    const driveUpload = await uploadReceiptToGoogleDrive(buffer, driveName, mimeType);
    if (driveUpload.ok) {
      google_drive_file_id = driveUpload.fileId;
      google_drive_url = driveUpload.webViewLink;
    }

    let transaction_id: string | null = null;
    if (autoExpense && scanData.amount && scanData.amount > 0) {
      const tx = await createTransaction({
        type: "expense",
        amount: scanData.amount,
        currency: normalizeCurrency(scanData.currency ?? "MYR"),
        category: scanData.category ?? "other",
        description: scanData.merchant ?? "Receipt expense",
        account: "cash",
        transaction_date: scanData.receipt_date ?? new Date().toISOString().split("T")[0],
      });
      transaction_id = tx.id;
    }

    const receipt = await createReceipt({
      filename,
      mime_type: mimeType,
      merchant: scanData.merchant,
      amount: scanData.amount,
      currency: scanData.currency,
      category: scanData.category,
      receipt_date: scanData.receipt_date,
      notes: scanData.notes,
      transaction_id,
      google_drive_file_id,
      google_drive_url,
      scanned_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        receipt,
        scan: scanData,
        scanError,
        visionProvider: visionProvider,
        driveUploaded: Boolean(google_drive_file_id),
        driveError: driveUpload.ok ? null : driveUpload.error,
        transactionCreated: Boolean(transaction_id),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Finance Receipts POST]", error);
    return NextResponse.json({ error: "Failed to save receipt" }, { status: 500 });
  }
}
