"use client";

import { FileText } from "lucide-react";
import { isReceiptPdf } from "@/lib/finance/receipt-files";

export function ReceiptPreview({
  receiptId,
  mimeType,
  alt,
  className = "h-36 w-full bg-card",
  cacheKey,
}: {
  receiptId: string;
  mimeType: string;
  alt?: string;
  className?: string;
  cacheKey?: string;
}) {
  const src = `/api/finance/receipts/${receiptId}${cacheKey ? `?v=${cacheKey}` : ""}`;

  if (isReceiptPdf(mimeType)) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <iframe
          title={alt ?? "Receipt PDF"}
          src={src}
          className="h-full w-full border-0 bg-white"
        />
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
          <FileText className="h-3 w-3" />
          PDF
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? "Receipt"} className={`object-cover ${className}`} />
  );
}
