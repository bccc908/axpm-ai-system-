import "server-only";

import OpenAI from "openai";
import { proxiedFetch } from "@/lib/ai/proxy-fetch";
import { getMiniMaxConfig } from "@/lib/social/minimax-tts";

export type ReceiptVisionProvider =
  | "openrouter"
  | "openai"
  | "gemini"
  | "siliconflow"
  | "minimax";

const PROVIDER_ORDER: ReceiptVisionProvider[] = [
  "openrouter",
  "openai",
  "gemini",
  "siliconflow",
  "minimax",
];

const RECEIPT_VISION_PROMPT = `You are a receipt/resit OCR assistant. Read the image and return JSON only:
{
  "merchant": "store or vendor name",
  "amount": number or null,
  "currency": "MYR" or "CNY" or "USD" or null,
  "category": one of food, transport, housing, shopping, bills, entertainment, health, education, other,
  "receipt_date": "YYYY-MM-DD" or null,
  "notes": "brief summary"
}
Rules:
- amount must be a number (no currency symbols). Use the final total paid.
- Prefer MYR for Malaysian receipts, CNY for Chinese receipts.
- Normalize dates to YYYY-MM-DD.`;

function configured(provider: ReceiptVisionProvider): boolean {
  switch (provider) {
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY?.trim());
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY?.trim());
    case "siliconflow":
      return Boolean(process.env.SILICONFLOW_API_KEY?.trim());
    case "minimax":
      return Boolean(getMiniMaxConfig());
  }
}

export function receiptVisionProviders(): ReceiptVisionProvider[] {
  const raw = process.env.RECEIPT_VISION_PROVIDER?.trim().toLowerCase();
  if (raw) {
    return raw
      .split(",")
      .map((p) => p.trim())
      .filter((p): p is ReceiptVisionProvider =>
        PROVIDER_ORDER.includes(p as ReceiptVisionProvider),
      )
      .filter(configured);
  }
  return PROVIDER_ORDER.filter(configured);
}

export function isReceiptVisionConfigured(): boolean {
  return receiptVisionProviders().length > 0;
}

export function getReceiptVisionLabel(): string {
  const providers = receiptVisionProviders();
  if (providers.length === 0) return "none";
  return providers[0];
}

async function callOpenAiCompatible(input: {
  imageBase64: string;
  mimeType: string;
  apiKey: string;
  baseURL: string;
  model: string;
  useProxy?: boolean;
  extraHeaders?: Record<string, string>;
}): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  try {
    const client = new OpenAI({
      apiKey: input.apiKey,
      baseURL: input.baseURL.replace(/\/$/, ""),
      timeout: 90_000,
      maxRetries: 0,
      fetch: (input.useProxy ? proxiedFetch : fetch) as typeof fetch,
      defaultHeaders: input.extraHeaders,
    });

    const response = await client.chat.completions.create({
      model: input.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_VISION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.mimeType};base64,${input.imageBase64}`,
              },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) return { ok: false, error: "Empty vision response" };
    return { ok: true, raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Vision request failed",
    };
  }
}

async function callGemini(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "Gemini not configured" };

  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await proxiedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: RECEIPT_VISION_PROMPT },
              { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return { ok: false, error: data.error?.message ?? `Gemini HTTP ${response.status}` };
    }

    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    if (!raw.trim()) return { ok: false, error: "Gemini empty response" };
    return { ok: true, raw };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gemini failed" };
  }
}

async function runProvider(
  provider: ReceiptVisionProvider,
  imageBase64: string,
  mimeType: string,
): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  switch (provider) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim();
      if (!apiKey) return { ok: false, error: "OpenRouter not configured" };
      return callOpenAiCompatible({
        imageBase64,
        mimeType,
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        model:
          process.env.OPENROUTER_RECEIPT_VISION_MODEL?.trim() ||
          process.env.OPENROUTER_VISION_MODEL?.trim() ||
          "nvidia/nemotron-nano-12b-v2-vl:free",
        extraHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://talent.kaydenchiew.com",
          "X-Title": "AXPM Receipt Scan",
        },
      });
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) return { ok: false, error: "OpenAI not configured" };
      return callOpenAiCompatible({
        imageBase64,
        mimeType,
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
        model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
        useProxy: true,
      });
    }
    case "siliconflow": {
      const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
      if (!apiKey) return { ok: false, error: "SiliconFlow not configured" };
      return callOpenAiCompatible({
        imageBase64,
        mimeType,
        apiKey,
        baseURL: process.env.SILICONFLOW_BASE_URL?.trim() || "https://api.siliconflow.cn/v1",
        model:
          process.env.SILICONFLOW_RECEIPT_VISION_MODEL?.trim() ||
          process.env.SILICONFLOW_VISION_MODEL?.trim() ||
          "Qwen/Qwen2-VL-7B-Instruct",
      });
    }
    case "minimax": {
      const config = getMiniMaxConfig();
      if (!config) return { ok: false, error: "MiniMax not configured" };
      return callOpenAiCompatible({
        imageBase64,
        mimeType,
        apiKey: config.apiKey,
        baseURL: config.apiBase,
        model: process.env.MINIMAX_VISION_MODEL?.trim() || "MiniMax-M3",
      });
    }
    case "gemini":
      return callGemini({ imageBase64, mimeType });
    default:
      return { ok: false, error: "Unknown provider" };
  }
}

/** Vision OCR for receipt images — tries OpenRouter / OpenAI / Gemini / etc. */
export async function scanReceiptWithVision(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<{ ok: true; raw: string; provider: ReceiptVisionProvider } | { ok: false; error: string }> {
  const providers = receiptVisionProviders();
  if (providers.length === 0) {
    return { ok: false, error: "No vision API configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)" };
  }

  const imageBase64 = imageBuffer.toString("base64");
  const errors: string[] = [];

  for (const provider of providers) {
    const result = await runProvider(provider, imageBase64, mimeType);
    if (result.ok) {
      return { ok: true, raw: result.raw, provider };
    }
    errors.push(`${provider}: ${result.error}`);
    console.warn(`[Receipt vision] ${provider} failed:`, result.error);
  }

  return { ok: false, error: errors.join("; ") || "All vision providers failed" };
}
