import "server-only";

import OpenAI from "openai";
import { getMiniMaxConfig } from "@/lib/social/minimax-tts";
import { proxiedFetch } from "@/lib/ai/proxy-fetch";
import type { FortuneProfile } from "@/types/fortune";
import { formatYijingHexagramBlock } from "@/lib/fortune/hexagram";
import { formatQimenBlock } from "@/lib/fortune/qimen";
import { getChineseHourBranch } from "@/lib/fortune/hour";
import { isDeepSeekConfigured } from "@/lib/ai/deepseek-config";
import { generateFortuneReading } from "@/lib/fortune/reading";

const VISION_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type VisionProviderId =
  | "siliconflow"
  | "openrouter"
  | "gemini"
  | "minimax"
  | "openai";

const PROVIDER_IDS: VisionProviderId[] = [
  "gemini",
  "openai",
  "siliconflow",
  "openrouter",
  "minimax",
];

function visionProviders(): VisionProviderId[] {
  const raw = process.env.FORTUNE_VISION_PROVIDER?.trim().toLowerCase();
  const configured = (id: VisionProviderId) => {
    switch (id) {
      case "siliconflow":
        return Boolean(process.env.SILICONFLOW_API_KEY?.trim());
      case "openrouter":
        return Boolean(process.env.OPENROUTER_API_KEY?.trim());
      case "gemini":
        return Boolean(process.env.GEMINI_API_KEY?.trim());
      case "minimax":
        return Boolean(getMiniMaxConfig());
      case "openai":
        return Boolean(process.env.OPENAI_API_KEY?.trim());
    }
  };

  if (raw) {
    return raw
      .split(",")
      .map((p) => p.trim())
      .filter((p): p is VisionProviderId => PROVIDER_IDS.includes(p as VisionProviderId))
      .filter(configured);
  }

  return PROVIDER_IDS.filter(configured);
}

function imageDataUrl(faceImage: { data: string; mimeType: string }) {
  return `data:${faceImage.mimeType};base64,${faceImage.data}`;
}

function coerceTextField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(coerceTextField).filter(Boolean).join("\n\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, part]) => {
        const body = coerceTextField(part);
        if (!body) return "";
        return key.startsWith("##") ? `${key}\n${body}` : body;
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return String(value).trim();
}

function extractChatContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function visionMaxTokens() {
  const raw = Number(process.env.OPENROUTER_VISION_MAX_TOKENS?.trim());
  return Number.isFinite(raw) && raw >= 400 && raw <= 1800 ? raw : 1200;
}

function buildFaceExtractPrompt(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      systemPrompt:
        "你是面相观察员。只描述照片中清晰可见的五官与脸型，禁止命运解读、禁止编造看不清的细节。只输出合法 JSON，不要代码块。",
      textContext:
        "逐项用一句话描述（看不清写「照片中不清晰」）：额头/上停、眉毛、眼睛、鼻子、嘴巴、下巴/下停、气色、表情神态、三停比例观感、其他可见特征（痣/胡须/眼镜等）。\n" +
        '输出 {"forehead","eyebrows","eyes","nose","mouth","chin","complexion","expression","three_zones","other"}',
    };
  }
  return {
    systemPrompt:
      "Describe only clearly visible face features from the photo. No fortune telling. JSON only, no code fences.",
    textContext:
      "One sentence per field (write \"unclear in photo\" if not visible): forehead, brows, eyes, nose, mouth, chin, complexion, expression, three zones, other.\n" +
      'Output {"forehead","eyebrows","eyes","nose","mouth","chin","complexion","expression","three_zones","other"}',
  };
}

type FaceFeatures = {
  forehead: string;
  eyebrows: string;
  eyes: string;
  nose: string;
  mouth: string;
  chin: string;
  complexion: string;
  expression: string;
  three_zones: string;
  other: string;
};

function parseFaceFeaturesJson(raw: string): FaceFeatures {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? candidate) as Record<string, unknown>;

  const field = (key: string) => coerceTextField(parsed[key]) || "";
  const features: FaceFeatures = {
    forehead: field("forehead"),
    eyebrows: field("eyebrows"),
    eyes: field("eyes"),
    nose: field("nose"),
    mouth: field("mouth"),
    chin: field("chin"),
    complexion: field("complexion"),
    expression: field("expression"),
    three_zones: field("three_zones"),
    other: field("other"),
  };

  const filled = Object.values(features).filter((v) => v.length > 2).length;
  if (filled < 2) {
    throw new Error("Too few face features extracted");
  }
  return features;
}

function formatFaceFeaturesBlock(features: FaceFeatures, locale: "en" | "zh") {
  if (locale === "zh") {
    return [
      `- 额头/上停：${features.forehead || "—"}`,
      `- 眉毛：${features.eyebrows || "—"}`,
      `- 眼睛：${features.eyes || "—"}`,
      `- 鼻子：${features.nose || "—"}`,
      `- 嘴巴：${features.mouth || "—"}`,
      `- 下巴/下停：${features.chin || "—"}`,
      `- 气色：${features.complexion || "—"}`,
      `- 表情神态：${features.expression || "—"}`,
      `- 三停比例：${features.three_zones || "—"}`,
      features.other ? `- 其他：${features.other}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `- Forehead: ${features.forehead || "—"}`,
    `- Eyebrows: ${features.eyebrows || "—"}`,
    `- Eyes: ${features.eyes || "—"}`,
    `- Nose: ${features.nose || "—"}`,
    `- Mouth: ${features.mouth || "—"}`,
    `- Chin: ${features.chin || "—"}`,
    `- Complexion: ${features.complexion || "—"}`,
    `- Expression: ${features.expression || "—"}`,
    `- Three zones: ${features.three_zones || "—"}`,
    features.other ? `- Other: ${features.other}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function extractFaceFeaturesFromPhoto(
  faceImage: { data: string; mimeType: string },
  locale: "en" | "zh",
  providers: VisionProviderId[],
) {
  const { systemPrompt, textContext } = buildFaceExtractPrompt(locale);
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const result = await runProvider(provider, {
        faceImage,
        systemPrompt,
        textContext,
      });
      if (!result.ok) {
        errors.push(`${provider}: ${"error" in result ? result.error : "failed"}`);
        continue;
      }
      const features = parseFaceFeaturesJson(result.raw);
      return { ok: true as const, features, provider, errors };
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: false as const, errors };
}

function buildMianxiangSynthesisQuestion(
  input: {
    profile: FortuneProfile;
    locale: "en" | "zh";
    question?: string | null;
  },
  faceBlock: string | null,
) {
  const birthBranch = getChineseHourBranch(input.profile.birth_time);
  const classical = [
    formatYijingHexagramBlock(input.locale, new Date(), birthBranch),
    formatQimenBlock(input.profile, input.locale),
  ].join("\n\n");

  const parts =
    input.locale === "zh"
      ? [
          faceBlock
            ? `【照片面相观察 — 必须逐条引用到解读中，禁止忽略】\n${faceBlock}`
            : "【照片】未能自动识别五官细节，请据用户补充与命理档案推断，并说明「建议补拍正脸照或补充描述」。",
          classical,
          input.question?.trim() ? `【用户补充】${input.question.trim()}` : null,
          "要求：每个五官都要在正文中点名分析；易经卦象与奇门门星须与面相宫位交叉验证；用 ★ 评分与 ✅❌ 行动清单。",
        ]
      : [
          faceBlock
            ? `[Photo observations — cite each item in the reading]\n${faceBlock}`
            : "[Photo] Auto feature extraction failed — infer from notes and profile.",
          classical,
          input.question?.trim() ? `[User notes] ${input.question.trim()}` : null,
          "Cite each facial feature; cross-check I Ching and Qimen with face palaces; use ★ ratings and ✅❌ lists.",
        ];

  return parts.filter(Boolean).join("\n\n");
}

async function callOpenAiCompatibleVision(input: {
  faceImage: { data: string; mimeType: string };
  systemPrompt: string;
  textContext: string;
  apiKey: string;
  baseURL: string;
  model: string;
  useProxy?: boolean;
  extraHeaders?: Record<string, string>;
}) {
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
    temperature: 0.55,
    max_tokens: 2200,
    messages: [
      { role: "system", content: input.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: input.textContext },
          {
            type: "image_url",
            image_url: { url: imageDataUrl(input.faceImage) },
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  if (!raw.trim()) return { ok: false as const, error: "Empty vision response" };
  return { ok: true as const, raw };
}

async function callSiliconFlowVision(input: {
  faceImage: { data: string; mimeType: string };
  systemPrompt: string;
  textContext: string;
}) {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, error: "SiliconFlow not configured" };

  try {
    return await callOpenAiCompatibleVision({
      ...input,
      apiKey,
      baseURL: process.env.SILICONFLOW_BASE_URL?.trim() || "https://api.siliconflow.cn/v1",
      model: process.env.SILICONFLOW_VISION_MODEL?.trim() || "Qwen/Qwen2-VL-7B-Instruct",
    });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "SiliconFlow failed" };
  }
}

async function callOpenRouterVision(input: {
  faceImage: { data: string; mimeType: string };
  systemPrompt: string;
  textContext: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, error: "OpenRouter not configured" };

  const model =
    process.env.OPENROUTER_VISION_MODEL?.trim() || "nvidia/nemotron-nano-12b-v2-vl:free";
  const maxTokens = visionMaxTokens();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://talent.kaydenchiew.com",
        "X-Title": "Signal Flag Fortune",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: input.textContext },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl(input.faceImage),
                },
              },
            ],
          },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        ok: false as const,
        error: data.error?.message ?? `OpenRouter HTTP ${response.status}`,
      };
    }

    const raw = extractChatContent(data.choices?.[0]?.message?.content);
    if (!raw.trim()) return { ok: false as const, error: "OpenRouter empty response" };
    return { ok: true as const, raw };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OpenRouter failed";
    return { ok: false as const, error: msg.includes("abort") ? "OpenRouter timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiVision(input: {
  faceImage: { data: string; mimeType: string };
  systemPrompt: string;
  textContext: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, error: "Gemini not configured" };

  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await proxiedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: input.textContext },
              {
                inlineData: {
                  mimeType: input.faceImage.mimeType,
                  data: input.faceImage.data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 2200,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return { ok: false as const, error: data.error?.message ?? `Gemini HTTP ${response.status}` };
    }

    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    if (!raw.trim()) return { ok: false as const, error: "Gemini empty response" };
    return { ok: true as const, raw };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Gemini failed" };
  }
}

async function callMiniMaxVision(input: {
  faceImage: { data: string; mimeType: string };
  systemPrompt: string;
  textContext: string;
}) {
  const config = getMiniMaxConfig();
  if (!config) return { ok: false as const, error: "MiniMax not configured" };

  const model = process.env.MINIMAX_VISION_MODEL?.trim() || "MiniMax-M3";
  const url = `${config.apiBase}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: input.textContext },
            { type: "image_url", image_url: { url: imageDataUrl(input.faceImage) } },
          ],
        },
      ],
    }),
  });

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
    base_resp?: { status_msg?: string };
  };

  if (!response.ok) {
    const msg = data.error?.message ?? data.base_resp?.status_msg ?? `HTTP ${response.status}`;
    if (msg.includes("2056") || msg.includes("用量") || msg.includes("rate_limit")) {
      return { ok: false as const, error: "minimax_quota" as const };
    }
    return { ok: false as const, error: msg };
  }

  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) return { ok: false as const, error: "MiniMax empty response" };
  return { ok: true as const, raw };
}

async function callOpenAiVision(input: {
  faceImage: { data: string; mimeType: string };
  systemPrompt: string;
  textContext: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, error: "OpenAI not configured" };

  try {
    return await callOpenAiCompatibleVision({
      ...input,
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      useProxy: true,
    });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "OpenAI failed" };
  }
}

async function runProvider(
  provider: VisionProviderId,
  payload: {
    faceImage: { data: string; mimeType: string };
    systemPrompt: string;
    textContext: string;
  },
) {
  switch (provider) {
    case "siliconflow":
      return callSiliconFlowVision(payload);
    case "openrouter":
      return callOpenRouterVision(payload);
    case "gemini":
      return callGeminiVision(payload);
    case "minimax":
      return callMiniMaxVision(payload);
    case "openai":
      return callOpenAiVision(payload);
  }
}

export async function generateMianxiangFromPhoto(input: {
  faceImage: { data: string; mimeType: string };
  profile: FortuneProfile;
  locale: "en" | "zh";
  question?: string | null;
  mode?: "platform" | "customer";
  aiConfig?: { apiKey?: string; baseUrl?: string; model?: string };
}) {
  if (!VISION_MIME.has(input.faceImage.mimeType)) {
    return { ok: false as const, error: "Unsupported image type" };
  }

  const customerMode = input.mode === "customer";
  const textAiReady = customerMode
    ? Boolean(input.aiConfig?.apiKey?.trim())
    : isDeepSeekConfigured();

  if (!textAiReady) {
    return {
      ok: false as const,
      error:
        input.locale === "zh"
          ? "请配置 DEEPSEEK_API_KEY（.env.local），面相深度解读需要文字 AI。"
          : "Set DEEPSEEK_API_KEY in .env.local for deep face reading synthesis.",
    };
  }

  const providers = visionProviders();
  let visionProvider: VisionProviderId | null = null;
  let faceBlock: string | null = null;

  if (providers.length > 0) {
    const extracted = await extractFaceFeaturesFromPhoto(
      input.faceImage,
      input.locale,
      providers,
    );
    if (extracted.ok) {
      faceBlock = formatFaceFeaturesBlock(extracted.features, input.locale);
      visionProvider = extracted.provider;
    } else {
      console.warn("[Mianxiang vision] feature extract failed:", extracted.errors);
    }
  }

  const synthesisQuestion = buildMianxiangSynthesisQuestion(input, faceBlock);

  const textResult = await generateFortuneReading({
    topic: "mianxiang",
    question: synthesisQuestion,
    profile: input.profile,
    locale: input.locale,
    mode: input.mode,
    aiConfig: input.aiConfig,
  });

  if (!textResult.usedAi && textResult.reading.length < 200) {
    return {
      ok: false as const,
      error:
        input.locale === "zh"
          ? `面相解读失败：${"aiError" in textResult && textResult.aiError ? textResult.aiError : "文字 AI 未返回足够内容"}`
          : `Face reading failed: ${"aiError" in textResult && textResult.aiError ? textResult.aiError : "text AI returned too little"}`,
    };
  }

  return {
    ok: true as const,
    title: textResult.title,
    summary: textResult.summary,
    reading: textResult.reading,
    lucky: textResult.lucky,
    zodiac: textResult.zodiac,
    usedAi: textResult.usedAi,
    fortune_date: textResult.fortune_date ?? null,
    provider: visionProvider ? `${visionProvider}+deepseek` : "deepseek",
  };
}

export function isFortuneVisionConfigured(): boolean {
  return visionProviders().length > 0;
}

export function listConfiguredVisionProviders(): VisionProviderId[] {
  return visionProviders();
}
