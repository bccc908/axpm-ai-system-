import "server-only";

import { z } from "zod";
import { llmChat } from "@/lib/ai/deepseek-client";
import { fetchHlSpotQuote, type HlSpotQuote } from "@/lib/hyperliquid/price";
import { appendHlSignal } from "@/lib/hl-signals/store";
import type { HlSignalBias, HlSignalStrength } from "@/types/hl-signal";
import {
  buildSearchQuery,
  formatSearchResultsForPrompt,
  searchWeb,
} from "@/lib/ai/web-search";
import { enforceMinRiskReward, profitPolicyPromptLines } from "@/lib/market-signals/profit-policy";
import { okBrainMapPromptLines, resolveOkBrainMap } from "@/lib/market-signals/ok-brain-map";

const signalSchema = z.object({
  bias: z.enum(["long", "short", "neutral", "wait"]),
  strength: z.enum(["weak", "moderate", "strong"]),
  confidence: z.number().min(0).max(100),
  timeframe: z.string().min(1),
  entry_zone: z.object({ low: z.number(), high: z.number() }).nullable().optional(),
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

function normalizeBias(value: unknown): HlSignalBias {
  const t = String(value ?? "").toLowerCase();
  if (t.includes("long") || t.includes("多")) return "long";
  if (t.includes("short") || t.includes("空")) return "short";
  if (t.includes("wait") || t.includes("观望")) return "wait";
  return "neutral";
}

function normalizeStrength(value: unknown): HlSignalStrength {
  const t = String(value ?? "").toLowerCase();
  if (t.includes("strong") || t.includes("强")) return "strong";
  if (t.includes("weak") || t.includes("弱")) return "weak";
  return "moderate";
}

function buildSystemPrompt(locale: "en" | "zh") {
  if (locale === "zh") {
    return `你是专业 Hyperliquid BTC 永续（BTC-PERP）日内分析师，熟悉资金费率、持仓、清算与订单流。

输出要求：
- 给出可执行的永续盘面观点，不是现货泛论
- bookmap_playbook 写资金费率、清算墙、Delta/堆积如何触发进场
- orderflow_triggers：3-5 条具体条件
- 价位用美元
- 必须包含 invalidation
- 非投资建议，risk_notes 写清杠杆与爆仓风险
${profitPolicyPromptLines("zh")}
${okBrainMapPromptLines("zh")}

严格 JSON，字段：
bias(long|short|neutral|wait), strength, confidence(0-100), timeframe,
entry_zone{low,high}|null, stop_loss, take_profit[], thesis, bookmap_playbook,
orderflow_triggers[], risk_notes, invalidation, expires_hours, ok_brain_map`;
  }

  return `You are a professional Hyperliquid BTC-PERP analyst (funding, OI, liquidations, order flow).

Return strict JSON with: bias, strength, confidence, timeframe, entry_zone, stop_loss, take_profit, thesis, bookmap_playbook, orderflow_triggers, risk_notes, invalidation, expires_hours, ok_brain_map.

Not financial advice. Size for perpetual leverage risk.
${profitPolicyPromptLines("en")}
${okBrainMapPromptLines("en")}`;
}

async function maybeMacroContext(locale: "en" | "zh") {
  try {
    const query = buildSearchQuery(
      locale === "zh"
        ? "比特币 BTC Hyperliquid 永续 今日资金费率"
        : "bitcoin BTC Hyperliquid perp funding today",
    );
    const search = await searchWeb(query);
    return formatSearchResultsForPrompt(search.results);
  } catch {
    return "";
  }
}

export async function generateHlSignal(params: {
  locale: "en" | "zh";
  timeframe?: string;
  notes?: string | null;
  spotOverride?: number | null;
  includeNews?: boolean;
}) {
  const quote: HlSpotQuote | null =
    params.spotOverride != null
      ? {
          symbol: "BTC-PERP",
          price: params.spotOverride,
          change_pct: null,
          funding: null,
          open_interest: null,
          as_of: new Date().toISOString(),
          source: "manual",
        }
      : await fetchHlSpotQuote();

  const news = params.includeNews !== false ? await maybeMacroContext(params.locale) : "";
  const tf = params.timeframe?.trim() || "M15–H1";
  const funding =
    quote?.funding != null ? `${(quote.funding * 100).toFixed(4)}%` : "—";
  const oi = quote?.open_interest != null ? String(quote.open_interest) : "—";

  const userContent =
    params.locale === "zh"
      ? `品种：Hyperliquid BTC-PERP（比特币永续）
当前标记价：${quote ? `$${quote.price}（${quote.source}，${quote.change_pct != null ? `${quote.change_pct}%` : "—"}）` : "暂无实时价"}
资金费率：${funding}
持仓量 OI：${oi}
分析周期：${tf}
${params.notes?.trim() ? `交易员备注：${params.notes.trim()}\n` : ""}${news ? `\n【宏观/新闻参考】\n${news}\n` : ""}
请生成当前会话的 Hyperliquid BTC 永续交易信号。`
      : `Venue: Hyperliquid BTC-PERP
Mark: ${quote ? `$${quote.price}` : "unavailable"}
Funding: ${funding}
Open interest: ${oi}
Timeframe: ${tf}
${params.notes?.trim() ? `Trader notes: ${params.notes}\n` : ""}${news ? `\nMacro context:\n${news}\n` : ""}
Generate a Hyperliquid BTC perpetual trading signal.`;

  const callAi = (json: boolean) =>
    llmChat({
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
  let rawOkBrainMap: unknown;
  try {
    const raw = parseJsonLoose(ai.content);
    rawOkBrainMap = raw.ok_brain_map;
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
      risk_notes: String(raw.risk_notes ?? raw.risk ?? "杠杆自控，非投资建议。").trim(),
      invalidation: String(raw.invalidation ?? raw.invalidation_level ?? "").trim(),
      expires_hours: toNum(raw.expires_hours) ?? 8,
    };
    if (!normalized.thesis) throw new Error("empty thesis");
    if (!normalized.bookmap_playbook) normalized.bookmap_playbook = normalized.thesis;
    if (!normalized.invalidation) {
      normalized.invalidation =
        params.locale === "zh" ? "结构破坏或反向清算 cascade" : "Structure break or opposing liquidation cascade";
    }
    parsed = signalSchema.parse(normalized);
  } catch {
    return {
      ok: false as const,
      error: params.locale === "zh" ? "信号生成失败，请重试" : "Signal generation failed — retry",
    };
  }

  const sized = enforceMinRiskReward({
    bias: parsed.bias,
    entry_zone: parsed.entry_zone ?? null,
    stop_loss: parsed.stop_loss ?? null,
    take_profit: parsed.take_profit,
  });

  const expiresHours = parsed.expires_hours ?? 8;
  const expiresAt = new Date(Date.now() + expiresHours * 3600_000).toISOString();
  const okBrainMap = resolveOkBrainMap(rawOkBrainMap, {
    locale: params.locale,
    symbol: "BTC-PERP",
    bias: parsed.bias,
    timeframe: parsed.timeframe,
    thesis: parsed.thesis,
    bookmap_playbook: parsed.bookmap_playbook,
    orderflow_triggers: parsed.orderflow_triggers,
    invalidation: parsed.invalidation,
    expires_hours: expiresHours,
  });

  const signal = await appendHlSignal({
    symbol: "BTC-PERP",
    spot_price: quote?.price ?? null,
    bias: parsed.bias,
    strength: parsed.strength,
    confidence: Math.round(parsed.confidence),
    timeframe: parsed.timeframe,
    entry_zone: sized.entry_zone,
    stop_loss: sized.stop_loss,
    take_profit: sized.take_profit,
    thesis: parsed.thesis,
    bookmap_playbook: parsed.bookmap_playbook,
    orderflow_triggers: parsed.orderflow_triggers,
    risk_notes: sized.adjusted
      ? `${parsed.risk_notes}\n[系统] 目标位已按最低盈亏比（TP1≥2R / TP2≥3R）校准。`
      : parsed.risk_notes,
    invalidation: parsed.invalidation,
    expires_at: expiresAt,
    notes: params.notes?.trim() || null,
    ok_brain_map: okBrainMap,
  });

  return { ok: true as const, signal, quote };
}
