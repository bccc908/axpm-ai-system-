import type { ReceiptScanResult } from "@/types/finance";
import { getOpenAI, getChatModel } from "@/lib/ai/client";
import { getLlmDisplayName } from "@/lib/ai/llm-config";

export async function scanReceiptImage(
  base64: string,
  mimeType: string,
): Promise<{ ok: true; data: ReceiptScanResult } | { ok: false; error: string }> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      ok: true,
      data: {
        merchant: null,
        amount: null,
        currency: null,
        category: null,
        receipt_date: null,
        notes: `${getLlmDisplayName()} not configured — receipt saved without auto-scan`,
      },
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: getChatModel(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract data from this receipt/resit image. Return JSON only:
{
  "merchant": "store or vendor name",
  "amount": number or null,
  "currency": "MYR" or "CNY" or "USD" or null,
  "category": one of food, transport, housing, shopping, bills, entertainment, health, education, other,
  "receipt_date": "YYYY-MM-DD" or null,
  "notes": "brief summary of items or payment method"
}
Use MYR for Malaysian receipts, CNY for Chinese receipts when detectable.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 400,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      ok: true,
      data: {
        merchant: typeof parsed.merchant === "string" ? parsed.merchant : null,
        amount: typeof parsed.amount === "number" ? parsed.amount : null,
        currency: typeof parsed.currency === "string" ? parsed.currency : null,
        category: typeof parsed.category === "string" ? parsed.category : null,
        receipt_date: typeof parsed.receipt_date === "string" ? parsed.receipt_date : null,
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
      },
    };
  } catch (error) {
    console.error("[Receipt scan]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Receipt scan failed",
    };
  }
}
