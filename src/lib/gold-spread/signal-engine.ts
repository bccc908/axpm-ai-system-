import "server-only";

import { z } from "zod";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { fetchGoldSpreadSnapshot } from "@/lib/gold-spread/quotes";
import { appendGoldSpreadSignal } from "@/lib/gold-spread/store";
import type { XauSignalBias, XauSignalStrength } from "@/types/xau-signal";
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

function normalizeBias(value: unknown): XauSignalBias {
  const t = String(value ?? "").toLowerCase();
  if (t.includes("long") || t.includes("多")) return "long";
  if (t.includes("short") || t.includes("空")) return "short";
  if (t.includes("wait") || t.includes("观望")) return "wait";
  return "neutral";
}

function normalizeStrength(value: unknown): XauSignalStrength {
  const t = String(value ?? "").toLowerCase();
  if (t.includes("strong") || t.includes("强")) return "strong";
  if (t.includes("weak") || t.includes("弱")) return "weak";
  return "moderate";
}

function buildSystemPrompt(locale: "en" | "zh") {
  if (locale === "zh") {
    return `你是专业黄金跨市场分析师，专门比较 XAUUSD（伦敦/COMEX 现货金）与 XAUUSDT（币安黄金/USDT）的价格行为差异。

核心任务：
- 判断谁在领涨/领跌（price action leader）
- 解释价差（XAUUSDT − XAUUSD）：加密金溢价还是折价
- 给出可执行计划：做 XAUUSDT、做 XAUUSD，或做价差回归
- bias: long = 加密金偏弱/折价，倾向做多 XAUUSDT 追赶现货；short = 加密金偏强/溢价，倾向做空 XAUUSDT 或等溢价回落；neutral/wait = 两边同步
- entry/stop/TP 以 XAUUSDT 价位为主（1-2 位小数）
- bookmap_playbook 写两边节奏差：谁先突破、谁滞后、价差扩大/收敛怎么做
- orderflow_triggers：3-5 条
- 必须含 invalidation；非投资建议
${profitPolicyPromptLines("zh")}
${okBrainMapPromptLines("zh")}

严格 JSON，字段：
bias(long|short|neutral|wait), strength, confidence(0-100), timeframe,
entry_zone{low,high}|null, stop_loss, take_profit[], thesis, bookmap_playbook,
orderflow_triggers[], risk_notes, invalidation, expires_hours, ok_brain_map`;
  }

  return `You compare XAUUSD (spot/COMEX gold) vs XAUUSDT (Binance gold/USDT) price action.

Bias: long = crypto gold cheap/lagging → favor long XAUUSDT catch-up; short = crypto gold rich/leading → fade XAUUSDT or wait for premium to mean-revert; wait/neutral = both venues aligned.
Give entry/stop/TP in XAUUSDT (1–2 decimals). Explain the spread (XAUUSDT − XAUUSD) and who is leading.
${profitPolicyPromptLines("en")}
${okBrainMapPromptLines("en")}

Strict JSON: bias, strength, confidence, timeframe, entry_zone, stop_loss, take_profit, thesis, bookmap_playbook, orderflow_triggers, risk_notes, invalidation, expires_hours, ok_brain_map.`;
}

async function maybeMacroContext(locale: "en" | "zh") {
  try {
    const query = buildSearchQuery(
      locale === "zh" ? "黄金 XAUUSD XAUUSDT 价差 美元 美联储" : "gold XAUUSD vs XAUUSDT spread dollar Fed",
    );
    const search = await searchWeb(query);
    return formatSearchResultsForPrompt(search.results);
  } catch {
    return "";
  }
}

export async function generateGoldSpreadSignal(params: {
  locale: "en" | "zh";
  timeframe?: string;
  notes?: string | null;
  spotOverride?: number | null;
  includeNews?: boolean;
}) {
  const snap = await fetchGoldSpreadSnapshot();
  if (!snap) {
    return {
      ok: false as const,
      error:
        params.locale === "zh"
          ? "无法同时取到 XAUUSD 与 XAUUSDT 报价，请稍后重试"
          : "Could not fetch both XAUUSD and XAUUSDT quotes — retry",
    };
  }

  const news = params.includeNews !== false ? await maybeMacroContext(params.locale) : "";
  const tf = params.timeframe?.trim() || "M15–H1";
  const usdCh = snap.xauusd_change_pct != null ? `${snap.xauusd_change_pct}%` : "—";
  const usdtCh = snap.xauusdt_change_pct != null ? `${snap.xauusdt_change_pct}%` : "—";
  const leaderLabel =
    snap.leader === "xauusdt" ? "XAUUSDT leading" : snap.leader === "xauusd" ? "XAUUSD leading" : "aligned";

  const userContent =
    params.locale === "zh"
      ? `对比品种：XAUUSD（现货/COMEX） vs XAUUSDT（币安黄金）
XAUUSD：$${snap.xauusd}（${snap.xauusd_source}，涨跌 ${usdCh}）
XAUUSDT：$${snap.xauusdt}（${snap.xauusdt_source}，涨跌 ${usdtCh}）
价差 XAUUSDT−XAUUSD：${snap.spread >= 0 ? "+" : ""}${snap.spread}（${snap.spread_pct}%）${snap.spread > 0 ? " 加密金溢价" : snap.spread < 0 ? " 加密金折价" : " 持平"}
领涨方：${leaderLabel}
分析周期：${tf}
${params.notes?.trim() ? `交易员备注：${params.notes.trim()}\n` : ""}${news ? `\n【宏观/新闻参考】\n${news}\n` : ""}
请比较两边价格行为差异，并给出以 XAUUSDT 为主的交易信号（可说明是否做价差回归）。`
      : `Compare XAUUSD vs XAUUSDT price action.
XAUUSD: $${snap.xauusd} (${snap.xauusd_source}, ${usdCh})
XAUUSDT: $${snap.xauusdt} (${snap.xauusdt_source}, ${usdtCh})
Spread USDT−USD: ${snap.spread >= 0 ? "+" : ""}${snap.spread} (${snap.spread_pct}%)
Leader: ${leaderLabel}
Timeframe: ${tf}
${params.notes?.trim() ? `Trader notes: ${params.notes}\n` : ""}${news ? `\nMacro context:\n${news}\n` : ""}
Explain the divergence and give an XAUUSDT-primary trade (or spread mean-reversion).`;

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
    symbol: "XAUUSD-XAUUSDT",
    bias: parsed.bias,
    timeframe: parsed.timeframe,
    thesis: parsed.thesis,
    bookmap_playbook: parsed.bookmap_playbook,
    orderflow_triggers: parsed.orderflow_triggers,
    invalidation: parsed.invalidation,
    expires_hours: expiresHours,
  });

  const signal = await appendGoldSpreadSignal({
    symbol: "XAUUSD-XAUUSDT",
    spot_price: snap.xauusdt,
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
    spread: snap,
  });

  return { ok: true as const, signal, quote: snap };
}
