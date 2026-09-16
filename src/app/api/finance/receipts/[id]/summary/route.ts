import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/finance/store";
import {
  editedReceiptDownloadName,
  generateEditedReceiptPdf,
} from "@/lib/finance/receipt-pdf-overlay";

/** Download Trip.com-style receipt with edited dates/amount on original layout. */
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
    const pdf = await generateEditedReceiptPdf(receipt);
    const downloadName = editedReceiptDownloadName(receipt);
    const encoded = encodeURIComponent(downloadName);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${downloadName.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (error) {
    console.error("[Finance Receipt summary]", error);
    return NextResponse.json({ error: "Failed to generate receipt PDF" }, { status: 500 });
  }
}
