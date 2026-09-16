import type { ReceiptScanResult } from "@/types/finance";
import { getOpenAI, getChatModel } from "@/lib/ai/client";
import { getLlmDisplayName, getLlmProvider } from "@/lib/ai/llm-config";
import { scanReceiptWithVision } from "@/lib/ai/receipt-vision";
import { isReceiptPdf } from "@/lib/finance/receipt-files";
import { pdfFirstPageToJpeg } from "@/lib/finance/pdf-to-image";

const RECEIPT_JSON_PROMPT = `Extract data from this receipt/resit document. Return JSON only:
{
  "merchant": "store or vendor name",
  "amount": number or null,
  "currency": "MYR" or "CNY" or "USD" or null,
  "category": one of food, transport, housing, shopping, bills, entertainment, health, education, other,
  "receipt_date": "YYYY-MM-DD" or null,
  "notes": "brief summary of items or payment method"
}
Use MYR for Malaysian receipts, CNY for Chinese receipts when detectable.
For totals, prefer the final amount paid (Grand Total / Total / 合计).`;

export function parseReceiptScanJson(raw: string): ReceiptScanResult {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  let amount: number | null = null;
  if (typeof parsed.amount === "number") {
    amount = parsed.amount;
  } else if (typeof parsed.amount === "string") {
    const cleaned = parsed.amount.replace(/[^\d.,]/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    amount = Number.isFinite(n) ? n : null;
  }

  let currency =
    typeof parsed.currency === "string" ? parsed.currency.toUpperCase().replace("MYR", "MYR") : null;
  if (currency) {
    if (/^RM|MYR/i.test(currency)) currency = "MYR";
    else if (/CNY|RMB|¥/.test(currency)) currency = "CNY";
  }

  let receipt_date =
    typeof parsed.receipt_date === "string" ? parsed.receipt_date : null;
  if (receipt_date) {
    const iso = receipt_date.match(/(\d{4})-(\d{2})-(\d{2})/);
    const zh = receipt_date.match(/(\d{4})年(\d{1,2})月(\d{1,2})/);
    if (iso) receipt_date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    else if (zh) {
      receipt_date = `${zh[1]}-${zh[2].padStart(2, "0")}-${zh[3].padStart(2, "0")}`;
    }
  }

  return {
    merchant: typeof parsed.merchant === "string" ? parsed.merchant : null,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    currency,
    category: typeof parsed.category === "string" ? parsed.category : null,
    receipt_date,
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
  };
}

function noLlmScanNote(): ReceiptScanResult {
  return {
    merchant: null,
    amount: null,
    currency: null,
    category: null,
    receipt_date: null,
    notes: `${getLlmDisplayName()} not configured — receipt saved without auto-scan`,
  };
}

function scanFailedNote(detail?: string): ReceiptScanResult {
  return {
    merchant: null,
    amount: null,
    currency: null,
    category: null,
    receipt_date: null,
    notes: detail
      ? `Scan failed (${detail}) — tap AI rescan or edit manually`
      : "Scan failed — tap AI rescan or edit manually",
  };
}

async function scanWithTextLlm(text: string): Promise<ReceiptScanResult | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const response = await openai.chat.completions.create({
      model: getChatModel(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `${RECEIPT_JSON_PROMPT}\n\nReceipt text:\n${text.slice(0, 12000)}`,
        },
      ],
      max_tokens: 400,
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    return parseReceiptScanJson(raw);
  } catch (error) {
    console.warn("[Receipt scan] text LLM failed:", error);
    return null;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text.trim();
      return text.length > 30 ? text : null;
    } finally {
      await parser.destroy();
    }
  } catch {
    return null;
  }
}

async function scanImageBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ data: ReceiptScanResult; scanError?: string; visionProvider?: string }> {
  const vision = await scanReceiptWithVision(buffer, mimeType);
  if (vision.ok) {
    try {
      const data = parseReceiptScanJson(vision.raw);
      return {
        data: {
          ...data,
          notes: data.notes ?? `AI vision (${vision.provider})`,
        },
        visionProvider: vision.provider,
      };
    } catch (error) {
      return {
        data: scanFailedNote("Invalid JSON from vision"),
        scanError: error instanceof Error ? error.message : "Parse failed",
      };
    }
  }

  return {
    data: scanFailedNote(vision.error),
    scanError: vision.error,
  };
}

async function scanReceiptPdf(
  buffer: Buffer,
): Promise<{ data: ReceiptScanResult; scanError?: string; visionProvider?: string }> {
  const text = await extractPdfText(buffer);
  if (text && getOpenAI()) {
    const fromText = await scanWithTextLlm(text);
    if (fromText?.amount || fromText?.merchant) {
      return {
        data: { ...fromText, notes: fromText.notes ?? `AI text (${getLlmDisplayName()})` },
      };
    }
  }

  const rendered = await pdfFirstPageToJpeg(buffer);
  if (rendered) {
    const vision = await scanImageBuffer(rendered.buffer, rendered.mimeType);
    if (vision.data.amount || vision.data.merchant) {
      return vision;
    }
    if (!vision.scanError) return vision;
  }

  if (text) {
    const fromText = await scanWithTextLlm(text);
    if (fromText) return { data: fromText };
  }

  return {
    data: scanFailedNote("Could not read PDF — try a clearer scan or photo"),
    scanError: "PDF OCR failed",
  };
}

/** Scan receipt from image or PDF. Never throws. */
export async function scanReceipt(
  buffer: Buffer,
  mimeType: string,
  filename = "receipt",
): Promise<{
  ok: true;
  data: ReceiptScanResult;
  scanError?: string;
  visionProvider?: string;
}> {
  try {
    if (isReceiptPdf(mimeType, filename)) {
      const result = await scanReceiptPdf(buffer);
      return { ok: true, ...result };
    }

    if (!mimeType.startsWith("image/")) {
      return { ok: true, data: scanFailedNote("Unsupported file type") };
    }

    const openai = getOpenAI();
    const hasVision = Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);

    if (hasVision) {
      return { ok: true, ...(await scanImageBuffer(buffer, mimeType)) };
    }

    if (!openai) {
      return { ok: true, data: noLlmScanNote() };
    }

    if (getLlmProvider() === "deepseek") {
      return {
        ok: true,
        data: scanFailedNote("DeepSeek cannot read images — set OPENROUTER_API_KEY for AI OCR"),
        scanError: "No vision API",
      };
    }

    return { ok: true, ...(await scanImageBuffer(buffer, mimeType)) };
  } catch (error) {
    console.error("[Receipt scan]", error);
    const message = error instanceof Error ? error.message : "Receipt scan failed";
    return { ok: true, data: scanFailedNote(message), scanError: message };
  }
}

/** @deprecated Use scanReceipt */
export async function scanReceiptImage(
  base64: string,
  mimeType: string,
): Promise<{ ok: true; data: ReceiptScanResult } | { ok: false; error: string }> {
  const result = await scanReceipt(Buffer.from(base64, "base64"), mimeType);
  if (result.scanError) {
    return { ok: false, error: result.scanError };
  }
  return { ok: true, data: result.data };
}
