import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { scanReceiptImage } from "@/lib/ai/receipt-scan";
import { uploadReceiptToGoogleDrive } from "@/lib/integrations/google-drive";
import {
  createReceipt,
  createTransaction,
  ensureReceiptsDir,
  listReceipts,
  RECEIPTS_DIR,
} from "@/lib/finance/store";
import { normalizeCurrency } from "@/lib/finance/helpers";
import fs from "fs/promises";

export async function GET() {
  const receipts = await listReceipts();
  return NextResponse.json({ receipts });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const autoExpense = form.get("auto_expense") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const mimeType = file.type || "image/jpeg";
    if (!allowed.includes(mimeType) && !mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const filename = `${randomUUID()}.${ext}`;

    await ensureReceiptsDir();
    await fs.writeFile(path.join(RECEIPTS_DIR, filename), buffer);

    const base64 = buffer.toString("base64");
    const scan = await scanReceiptImage(base64, mimeType);
    const scanData = scan.ok
      ? scan.data
      : {
          merchant: null,
          amount: null,
          currency: null,
          category: null,
          receipt_date: null,
          notes: "Scan failed",
        };

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
