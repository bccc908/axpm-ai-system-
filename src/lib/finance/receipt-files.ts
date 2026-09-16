export const RECEIPT_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const RECEIPT_PDF_MIME = "application/pdf";

export const RECEIPT_ALLOWED_MIMES = [...RECEIPT_IMAGE_MIMES, RECEIPT_PDF_MIME] as const;

export function isReceiptPdf(mimeType: string, filename?: string) {
  return (
    mimeType === RECEIPT_PDF_MIME ||
    (filename?.toLowerCase().endsWith(".pdf") ?? false)
  );
}

export function isReceiptImage(mimeType: string) {
  return RECEIPT_IMAGE_MIMES.includes(mimeType as (typeof RECEIPT_IMAGE_MIMES)[number]) ||
    mimeType.startsWith("image/");
}

export function isAllowedReceiptMime(mimeType: string, filename?: string) {
  if (isReceiptPdf(mimeType, filename)) return true;
  if (isReceiptImage(mimeType)) return true;
  return false;
}

export function receiptExtension(mimeType: string, filename?: string): string {
  if (isReceiptPdf(mimeType, filename)) return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

export function normalizeReceiptMime(mimeType: string, filename?: string): string {
  if (isReceiptPdf(mimeType, filename)) return RECEIPT_PDF_MIME;
  if (mimeType && isReceiptImage(mimeType)) return mimeType;
  return "image/jpeg";
}

/** Safe download basename — dots in merchant (e.g. Trip.com) break macOS duplicate naming. */
export function sanitizeReceiptDownloadBase(name: string): string {
  return (
    name
      .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "receipt"
  );
}

export function buildReceiptDownloadName(input: {
  merchant?: string | null;
  amount?: number | null;
  currency?: string | null;
  receipt_date?: string | null;
  mime_type: string;
  filename: string;
}): string {
  const ext = receiptExtension(input.mime_type, input.filename);
  const base = sanitizeReceiptDownloadBase(input.merchant ?? "receipt");
  const parts = [base];
  if (input.amount != null && input.amount > 0) {
    parts.push(`${input.currency ?? "MYR"}${input.amount}`);
  }
  if (input.receipt_date) {
    parts.push(input.receipt_date);
  }
  return `${parts.join("_")}.${ext}`;
}
