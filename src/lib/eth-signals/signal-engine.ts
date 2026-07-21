import "server-only";

import { z } from "zod";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { fetchEthSpotQuote, type EthSpotQuote } from "@/lib/eth-signals/price";
import { appendEthSignal } from "@/lib/eth-signals/store";
import type { EthSignalBias, EthSignalStrength } from "@/types/eth-signal";
import {
  buildSearchQuery,
  formatSearchResultsForPrompt,
  searchWeb,
} from "@/lib/ai/web-search";

const signalSchema = z.object({
  bias: z.enum(["long", "short", "neutral", "wait"]),
  strength: z.enum(["weak", "moderate", "strong"]),
  confidence: z.number().min(0).max(100),
  timeframe: z.string().min(1),
  entry_zone: z
    .object({
      low: z.number(),
      high: z.number(),
    })
    .nullable()
    .optional(),
  stop_loss: z.number().nullable().optional(),
  take_profit: z.array(z.number()).default([]),
  thesis: z.string().min(1),
  bookmap_playbook: z.string().min(1),
  orderflow_triggers: z.array(z.string()).default([]),
  risk_notes: z.string().min(1),
  invalidation: z.string().min(1),
  expires_hours: z.number().min(1).max(72).optional(),
});

function stripJsonFence(content: string) {
  const t = content.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : t;
}

function parseJsonLoose(content: string): Record<string, unknown> {
  const stripped = stripJsonFence(content);
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("invalid json");
  }
}

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeBias(value: unknown): EthSignalBias {
  const t = String(value ?? "").toLowerCase();
  if (t.includes("long") || t.includes("多")) return "long";
  if (t.includes("short") || t.includes("空")) return "short";
  if (t.includes("wait") || t.includes("观望")) return "wait";
  return "neutral";
}

function normalizeStrength(value: unknown): EthSignalStrength {
  const t = String(value ?? "").toLowerCase();
  if (t.includes("strong") || t.includes("强")) return "strong";
  if (t.includes("weak") || t.includes("弱")) return "weak";
  return "moderate";
}

function buildSystemPrompt(locale: "en" | "zh") {
  if (locale === "zh") {
    return `你是专业 ETHUSD（以太坊）日内交易分析师，精通订单流、DOM、关键价位与链上/宏观催化。

输出要求：
- 给出可执行的盘面观点，不是泛泛评论
- bookmap_playbook 字段写实战读法：大单吸收、Delta 背离、POC、流动性真空，什么条件触发进场
- orderflow_triggers：3-5 条具体触发条件
- 价位用美元，保留整数或 1-2 位小数
- 必须包含 invalidation（失效价位/条件）
- 非投资建议，risk_notes 写清仓位与波动风险

严格 JSON，字段：
bias(long|short|neutral|wait), strength, confidence(0-100), timeframe,
entry_zone{low,high}|null, stop_loss, take_profit[], thesis, bookmap_playbook,
orderflow_triggers[], risk_notes, invalidation, expires_hours`;
  }

  return `You are a professional ETHUSD intraday analyst specializing in order flow, DOM, and key levels.

Return strict JSON with: bias, strength, confidence, timeframe, entry_zone, stop_loss, take_profit, thesis, bookmap_playbook, orderflow_triggers, risk_notes, invalidation, expires_hours.

bookmap_playbook must describe order-flow reading and entry triggers. Not financial advice.`;
}

async function maybeMacroContext(locale: "en" | "zh") {
  try {
    const query = buildSearchQuery(
      locale === "zh"
        ? "以太坊 ETH 今日 ETF 美联储 走势"
        : "ethereum ETH today ETF Fed price drivers",
    );
    const search = await searchWeb(query);
    return formatSearchResultsForPrompt(search.results);
  } catch {
    return "";
  }
}

export async function generateEthSignal(params: {
  locale: "en" | "zh";
  timeframe?: string;
  notes?: string | null;
  spotOverride?: number | null;
  includeNews?: boolean;
}) {
  const quote: EthSpotQuote | null =
    params.spotOverride != null
      ? {
          symbol: "ETHUSD",
          price: params.spotOverride,
          change_pct: null,
          as_of: new Date().toISOString(),
          source: "manual",
        }
      : await fetchEthSpotQuote();

  const news = params.includeNews !== false ? await maybeMacroContext(params.locale) : "";
  const tf = params.timeframe?.trim() || "M15–H1";

  const userContent =
    params.locale === "zh"
      ? `品种：ETHUSD（以太坊现货）
当前参考价：${quote ? `$${quote.price}（${quote.source}，${quote.change_pct != null ? `${quote.change_pct}%` : "—"}）` : "暂无实时价，请按近期结构推断并标注假设"}
分析周期：${tf}
${params.notes?.trim() ? `交易员备注：${params.notes.trim()}\n` : ""}${news ? `\n【宏观/新闻参考】\n${news}\n` : ""}
请生成当前会话的专业以太坊交易信号。`
      : `Symbol: ETHUSD
Spot: ${quote ? `$${quote.price}` : "unavailable — state assumptions"}
Timeframe: ${tf}
${params.notes?.trim() ? `Trader notes: ${params.notes}\n` : ""}${news ? `\nMacro context:\n${news}\n` : ""}
Generate a professional ethereum trading signal.`;

  const callAi = (json: boolean) =>
    deepSeekChat({
      messages: [
        { role: "system", content: buildSystemPrompt(params.locale) },
        { role: "user", content: userContent },
      ],
      json,
      temperature: 0.35,
      maxTokens: 1400,
    });

  let ai = await callAi(true);
  if (!ai.ok) return { ok: false as const, error: ai.error };
  if (!ai.content.trim()) {
    ai = await callAi(false);
    if (!ai.ok) return { ok: false as const, error: ai.error };
  }

  let parsed: z.infer<typeof signalSchema>;
  try {
    const raw = parseJsonLoose(ai.content);
    const normalized = {
      bias: normalizeBias(raw.bias ?? raw.direction),
      strength: normalizeStrength(raw.strength),
      confidence: toNum(raw.confidence) ?? 55,
      timeframe: String(raw.timeframe ?? tf),
      entry_zone: raw.entry_zone ?? raw.entry ?? null,
      stop_loss: toNum(raw.stop_loss ?? raw.stop),
      take_profit: Array.isArray(raw.take_profit)
        ? raw.take_profit.map((v) => toNum(v)).filter((n): n is number => n != null)
        : Array.isArray(raw.targets)
          ? raw.targets.map((v) => toNum(v)).filter((n): n is number => n != null)
          : [],
      thesis: String(raw.thesis ?? raw.analysis ?? raw.summary ?? "").trim(),
      bookmap_playbook: String(raw.bookmap_playbook ?? raw.playbook ?? "").trim(),
      orderflow_triggers: Array.isArray(raw.orderflow_triggers)
        ? raw.orderflow_triggers.map(String)
        : [],
      risk_notes: String(raw.risk_notes ?? raw.risk ?? "仓位自控，非投资建议。").trim(),
      invalidation: String(raw.invalidation ?? raw.invalidation_level ?? "").trim(),
      expires_hours: toNum(raw.expires_hours) ?? 8,
    };
    if (!normalized.thesis) throw new Error("empty thesis");
    if (!normalized.bookmap_playbook) {
      normalized.bookmap_playbook = normalized.thesis;
    }
    if (!normalized.invalidation) {
      normalized.invalidation =
        params.locale === "zh" ? "结构破坏或反向吸收成立" : "Structure break or opposite absorption";
    }
    parsed = signalSchema.parse(normalized);
  } catch {
    return {
      ok: false as const,
      error:
        params.locale === "zh"
          ? "信号生成失败，请重试"
          : "Signal generation failed — retry",
    };
  }

  const expiresHours = parsed.expires_hours ?? 8;
  const expiresAt = new Date(Date.now() + expiresHours * 3600_000).toISOString();

  const signal = await appendEthSignal({
    symbol: "ETHUSD",
    spot_price: quote?.price ?? null,
    bias: parsed.bias,
    strength: parsed.strength,
    confidence: Math.round(parsed.confidence),
    timeframe: parsed.timeframe,
    entry_zone: parsed.entry_zone ?? null,
    stop_loss: parsed.stop_loss ?? null,
    take_profit: parsed.take_profit,
    thesis: parsed.thesis,
    bookmap_playbook: parsed.bookmap_playbook,
    orderflow_triggers: parsed.orderflow_triggers,
    risk_notes: parsed.risk_notes,
    invalidation: parsed.invalidation,
    expires_at: expiresAt,
    notes: params.notes?.trim() || null,
  });

  return { ok: true as const, signal, quote };
}
