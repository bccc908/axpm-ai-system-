import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { scanReceipt } from "@/lib/ai/receipt-scan";
import {
  ensureReceiptsDir,
  getReceipt,
  RECEIPTS_DIR,
  updateReceipt,
} from "@/lib/finance/store";
import {
  isAllowedReceiptMime,
  normalizeReceiptMime,
  receiptExtension,
} from "@/lib/finance/receipt-files";

/** Replace receipt file (image or PDF) and re-scan — user confirms numbers in edit UI. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const current = await getReceipt(id);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
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

    const oldPath = path.join(RECEIPTS_DIR, current.filename);
    if (current.filename !== filename) {
      await fs.unlink(oldPath).catch(() => undefined);
    }

    const scan = await scanReceipt(buffer, mimeType, file.name);
    const scanData = scan.data;

    const receipt = await updateReceipt(id, {
      filename,
      mime_type: mimeType,
      scanned_at: new Date().toISOString(),
    });

    return NextResponse.json({ receipt, scan: scanData });
  } catch (error) {
    console.error("[Finance Receipt file POST]", error);
    return NextResponse.json({ error: "Failed to replace receipt file" }, { status: 500 });
  }
}
