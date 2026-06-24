import "server-only";

import { z } from "zod";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import type { FortuneFeedbackRating, FortuneReading } from "@/types/fortune";
import { fortuneAdvisorPersonaBlock } from "@/lib/fortune/advisor-persona";

const resultSchema = z.object({
  rating: z.enum(["accurate", "partial", "wrong"]),
  errors: z.string().min(80).max(3000),
  correction_notes: z.string().min(60).max(3000),
  reply: z.string().min(120).max(3500),
});

export type AnalyzedFortuneFeedback = z.infer<typeof resultSchema>;

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : JSON.stringify(item)))
      .filter(Boolean)
      .join("\n");
  }
  if (value == null) return "";
  return String(value).trim();
}

export function normalizeRating(value: unknown): FortuneFeedbackRating {
  const text = toText(value).toLowerCase();
  if (text === "accurate" || text === "准" || text === "准确") return "accurate";
  if (text === "wrong" || text === "不准" || text === "错误") return "wrong";
  if (text === "partial" || text === "部分准" || text === "部分") return "partial";
  const num = Number.parseFloat(text);
  if (!Number.isNaN(num)) {
    if (num >= 8) return "accurate";
    if (num >= 5) return "partial";
    return "wrong";
  }
  return "partial";
}

export function normalizeAnalysisRaw(raw: Record<string, unknown>) {
  return {
    rating: normalizeRating(raw.rating),
    reply: toText(raw.reply),
    errors: toText(raw.errors),
    correction_notes: toText(raw.correction_notes ?? raw.correctionNotes),
  };
}

function buildReadingContext(reading: FortuneReading) {
  const parts = [
    reading.fortune_date ? `日期：${reading.fortune_date}` : null,
    reading.topic ? `类型：${reading.topic}` : null,
    reading.question?.trim() ? `问事：${reading.question.trim()}` : null,
    reading.summary?.trim() ? `摘要：${reading.summary.trim()}` : null,
    reading.reading?.trim() ? `正文：\n${reading.reading.trim().slice(0, 4000)}` : null,
    reading.lucky
      ? `吉凶参考：${[reading.lucky.color, reading.lucky.number, reading.lucky.direction]
          .filter(Boolean)
          .join(" / ")}`
      : null,
  ].filter(Boolean);

  return parts.join("\n\n") || "（无分析正文）";
}

export async function analyzeFortuneFeedback(params: {
  reading: FortuneReading;
  actualOutcome: string;
  locale: "en" | "zh";
}) {
  const actual = params.actualOutcome.trim();
  if (!actual) {
    return { ok: false as const, error: "请先说说今天实际发生了什么" };
  }

  const readingContext = buildReadingContext(params.reading);

  const systemZh = `${fortuneAdvisorPersonaBlock("zh")}

你是 Kayden 的私人命理复盘顾问，不是敷衍的客服。

用户已完成一天，会用语音告诉你「实际发生了什么」。你要拿今天的命理解读（摘要+正文）逐条对照，写一份**扎实、具体、有温度**的复盘。

【严禁】
- 空话：「整体还行」「部分准确」「继续努力」
- 不引用分析原文里的具体判断（卦名、宜忌、财运、签约、出行等）
- 不引用用户原话里的具体事件（地名、金额、平台、客户、风险）
- 每条少于一行

【必须】
- reply：至少 4 段，共 150–400 字
  1) 先接住用户情绪（累、不顺、惊险等）
  2) 说清今天分析里**哪几句大体对**
  3) 说清**哪几句明显偏了**，引用分析原话 vs 用户事实
  4) 一句实在建议（明天/本周注意什么）
- errors：至少 3 条，格式固定：
  「①【维度】分析原话：…｜实际：…｜偏差：…」
  维度从财运、事业/合作、出行/状态、风险/平台、情绪/精力中选
- correction_notes：至少 4 条可执行规则，下次写每日运势时必须遵守，例如：
  「有入金但伴随违规/惊险 → 财运写『进账有险、先守后攻』，不写中上大吉」
- rating：只能是 accurate、partial、wrong 三个英文之一（不要用数字分数）
- errors 和 correction_notes 必须是字符串（多条用换行分隔），不要 JSON 数组

只输出 JSON，字段：rating, reply, errors, correction_notes（全部为字符串）`;

  const systemEn = `${fortuneAdvisorPersonaBlock("en")}

You are a thorough fortune review advisor. Compare the reading vs user's actual day in depth.
No generic fluff. Cite specific claims from the reading vs specific events the user mentioned.
reply: 4 paragraphs, empathetic and detailed.
errors: at least 3 lines formatted as Analysis said | Actual | Gap.
correction_notes: at least 4 actionable rules for future readings.
JSON only: rating, reply, errors, correction_notes`;

  const userContent =
    params.locale === "zh"
      ? `【今日命理解读全文】
标题：${params.reading.title}
${readingContext}

【用户口述：今天实际发生了什么】
${actual}

请深度复盘，输出 JSON。`
      : `Today's reading:
Title: ${params.reading.title}
${readingContext}

User's actual day:
${actual}

Deep review JSON.`;

  const ai = await deepSeekChat({
    messages: [
      { role: "system", content: params.locale === "zh" ? systemZh : systemEn },
      { role: "user", content: userContent },
    ],
    json: true,
    temperature: 0.4,
    maxTokens: 2400,
  });

  if (!ai.ok) {
    return { ok: false as const, error: ai.error };
  }

  try {
    const raw = JSON.parse(ai.content) as Record<string, unknown>;
    const normalized = normalizeAnalysisRaw(raw);
    const parsed = resultSchema.parse(normalized);
    return { ok: true as const, result: parsed };
  } catch {
    try {
      const raw = JSON.parse(ai.content) as Record<string, unknown>;
      const normalized = normalizeAnalysisRaw(raw);
      const relaxed = resultSchema
        .extend({
          errors: z.string().min(1).max(3000),
          correction_notes: z.string().min(1).max(3000),
          reply: z.string().min(1).max(3500),
        })
        .parse(normalized);
      return { ok: true as const, result: relaxed };
    } catch {
      return { ok: false as const, error: "AI 分析格式异常，请重试" };
    }
  }
}

export type { FortuneFeedbackRating };
