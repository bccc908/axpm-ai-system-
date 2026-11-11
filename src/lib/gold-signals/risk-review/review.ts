import "server-only";

import { z } from "zod";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { getDeepSeekModel, isDeepSeekConfigured } from "@/lib/ai/deepseek-config";
import { fetchGoldOhlc } from "@/lib/gold-signals/chart-data";
import { getGoldSignalById, saveGoldSignalRiskReview } from "@/lib/gold-signals/store";
import {
  computeDeterministicChecks,
  computeMarketContext,
  MIN_RR,
  type RiskSignalInput,
} from "@/lib/gold-signals/risk-review/checks";
import type {
  RiskAiReview,
  RiskAiStatus,
  RiskDeterministicChecks,
  RiskMarketContext,
  SignalRiskReview,
} from "@/lib/gold-signals/risk-review/types";

/** Full signal shape used for the prompt (GoldSignal satisfies it). */
export interface RiskReviewSignal extends RiskSignalInput {
  strength: string;
  confidence: number;
  thesis: string;
  orderflow_triggers: string[];
  risk_notes: string;
  invalidation: string;
  created_at: string;
}

const aiSchema = z.object({
  summary: z.string().min(1).max(600),
  confluence: z.object({
    supporting: z.array(z.string().min(1)).max(8).default([]),
    weak_or_forced: z.array(z.string().min(1)).max(8).default([]),
  }),
  trap_zones: z
    .array(
      z.object({
        price: z.union([z.number(), z.null()]).optional().transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
        label: z.string().min(1),
        note: z.string().default(""),
      }),
    )
    .max(8)
    .default([]),
  devils_advocate: z.array(z.string().min(1)).min(1).max(5),
  score: z.coerce.number().min(1).max(10),
  verdict: z
    .string()
    .transform((v) => v.toLowerCase().replace(/[\s-]+/g, "_"))
    .pipe(z.enum(["take_trade", "stand_aside"])),
  conditions: z.array(z.string().min(1)).max(8).default([]),
});

function stripJsonFence(content: string) {
  const t = content.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : t;
}

function parseJsonLoose(content: string): unknown {
  const stripped = stripJsonFence(content);
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(stripped.slice(start, end + 1));
    throw new Error("invalid json");
  }
}

/**
 * Load real OHLC bars (15m preferred, then 1h, then 5m) and compute indicator context.
 * Estimated/synthetic bar series are rejected so the review never reasons on made-up data.
 * Never throws.
 */
export async function loadRiskMarketContext(livePrice?: number | null): Promise<RiskMarketContext | null> {
  for (const interval of ["15m", "1h", "5m"] as const) {
    try {
      const payload = await fetchGoldOhlc(interval);
      if (/est\.|estimated|synthetic/i.test(payload.source)) continue;
      const ctx = computeMarketContext(payload.bars, { interval, source: payload.source, livePrice });
      if (ctx) return ctx;
    } catch {
      /* try next interval */
    }
  }
  return null;
}

export function buildRiskReviewPrompt(params: {
  signal: RiskReviewSignal;
  checks: RiskDeterministicChecks;
  context: RiskMarketContext | null;
  locale: "en" | "zh";
}) {
  const { signal, checks, context, locale } = params;
  const system = `You are the head of risk at a regulated FX/CFD broker reviewing an XAUUSD trade idea before it is sent to clients.
You are strict, quantitative and sceptical. You do not cheerlead. Your job is to find reasons the trade fails.
Rules:
- The R:R and breakeven win-rate figures are computed in code and are authoritative. Never recompute or contradict them.
- A primary R:R below 1:${MIN_RR}, levels on the wrong side of entry, or a non-directional bias means "stand_aside" with score ≤ 4.
- Judge confluence only from the data given. If an indicator is null, say it is unavailable — do not invent values.
- Stop-hunt / trap zones: focus on liquidity near the stop (round numbers, VAH/VAL, POC, VWAP, recent swing highs/lows).
- Give 2–3 devil's-advocate reasons NOT to take the trade, each concrete and tied to a level or indicator.
- Score 1–10 where 7+ means a clean, high-confluence setup worth risking capital on.
- Conditions: concrete, checkable conditions (price/level/time) under which the verdict holds or flips.
- Write all text fields in ${locale === "zh" ? "Simplified Chinese" : "English"}. Keep each bullet under 25 words.
Respond with ONLY a JSON object of this exact shape:
{"summary": string, "confluence": {"supporting": string[], "weak_or_forced": string[]}, "trap_zones": [{"price": number|null, "label": string, "note": string}], "devils_advocate": string[], "score": integer 1-10, "verdict": "take_trade"|"stand_aside", "conditions": string[]}`;

  const payload = {
    signal: {
      symbol: "XAUUSD",
      bias: signal.bias,
      strength: signal.strength,
      engine_confidence_pct: signal.confidence,
      timeframe: signal.timeframe,
      created_at: signal.created_at,
      spot_at_signal: signal.spot_price,
      entry_zone: signal.entry_zone,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      thesis: signal.thesis.slice(0, 1200),
      orderflow_triggers: signal.orderflow_triggers.slice(0, 6),
      engine_risk_notes: signal.risk_notes.slice(0, 600),
      invalidation: signal.invalidation.slice(0, 300),
    },
    deterministic_checks: {
      side: checks.side,
      entry_mid: checks.entry,
      stop: checks.stop,
      risk_pts: checks.risk_pts,
      targets: checks.targets,
      primary_rr: checks.primary_r,
      breakeven_win_rate: checks.breakeven_win_rate,
      min_rr: checks.min_r,
      rr_below_min: checks.rr_below_min,
      stop_atr_multiple: checks.stop_atr_multiple,
      entry_distance_from_price_pts: checks.entry_distance_pts,
      liquidity_near_stop: checks.liquidity_zones,
      flags: checks.flags.map((f) => `${f.severity}: ${f.message}`),
    },
    market_context: context,
  };

  return {
    system,
    user: `Review this signal. Data (JSON):\n${JSON.stringify(payload, null, 2)}`,
  };
}

function classifyFailure(error: string): Extract<RiskAiStatus, { state: "unavailable" }>["reason"] {
  const e = error.toLowerCase();
  if (e.includes("insufficient") || e.includes("balance") || e.includes("402")) return "insufficient_balance";
  if (e.includes("not set") || e.includes("invalid deepseek_api_key")) return "not_configured";
  return "request_failed";
}

/** Apply hard deterministic rules on top of the model output. */
function enforceHardRules(ai: Omit<RiskAiReview, "overridden_by_rule" | "model">, checks: RiskDeterministicChecks) {
  const critical = checks.flags.filter((f) => f.severity === "critical");
  if (critical.length === 0) return { ...ai, overridden_by_rule: null };
  const wasTake = ai.verdict === "take_trade";
  const capped = Math.min(ai.score, 4);
  return {
    ...ai,
    verdict: "stand_aside" as const,
    score: capped,
    overridden_by_rule:
      wasTake || capped !== ai.score ? critical.map((f) => f.code).join(", ") : null,
  };
}

/**
 * Run the full Risk Manager Review for a signal: deterministic checks always,
 * AI review when DeepSeek is available. Never throws.
 * Reusable by other flows (e.g. the Telegram approval gate).
 */
export async function reviewSignalRisk(
  signal: RiskReviewSignal,
  opts: { locale?: "en" | "zh"; context?: RiskMarketContext | null; skipAi?: boolean } = {},
): Promise<SignalRiskReview> {
  const locale = opts.locale ?? "en";
  const context = opts.context !== undefined ? opts.context : await loadRiskMarketContext(null);
  const checks = computeDeterministicChecks(signal, context);

  const base = {
    signal_id: signal.id,
    version: 1 as const,
    created_at: new Date().toISOString(),
    locale,
    checks,
    context,
  };

  if (opts.skipAi) {
    return { ...base, ai: null, ai_status: { state: "unavailable", reason: "request_failed", detail: "AI review skipped" } };
  }
  if (!isDeepSeekConfigured()) {
    return {
      ...base,
      ai: null,
      ai_status: { state: "unavailable", reason: "not_configured", detail: "DEEPSEEK_API_KEY not set" },
    };
  }

  try {
    const prompt = buildRiskReviewPrompt({ signal, checks, context, locale });
    const res = await deepSeekChat({
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      json: true,
      temperature: 0.2,
      maxTokens: 1400,
    });
    if (!res.ok) {
      return {
        ...base,
        ai: null,
        ai_status: { state: "unavailable", reason: classifyFailure(res.error), detail: res.error },
      };
    }
    const parsed = aiSchema.safeParse(parseJsonLoose(res.content));
    if (!parsed.success) {
      return {
        ...base,
        ai: null,
        ai_status: {
          state: "unavailable",
          reason: "invalid_output",
          detail: parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
      };
    }
    const data = parsed.data;
    const ai = enforceHardRules(
      {
        summary: data.summary,
        confluence: data.confluence,
        trap_zones: data.trap_zones,
        devils_advocate: data.devils_advocate.slice(0, 3),
        score: Math.round(data.score),
        verdict: data.verdict,
        conditions: data.conditions,
      },
      checks,
    );
    return { ...base, ai: { ...ai, model: res.model || getDeepSeekModel() }, ai_status: { state: "ok" } };
  } catch (error) {
    return {
      ...base,
      ai: null,
      ai_status: {
        state: "unavailable",
        reason: "invalid_output",
        detail: error instanceof Error ? error.message : "Unparseable AI response",
      },
    };
  }
}

/** Review a stored gold signal by id and persist the result on the signal. */
export async function runAndStoreGoldSignalRiskReview(
  id: string,
  opts: { locale?: "en" | "zh"; force?: boolean } = {},
): Promise<{ review: SignalRiskReview; cached: boolean } | null> {
  const signal = await getGoldSignalById(id);
  if (!signal) return null;
  if (!opts.force && signal.risk_review) {
    return { review: signal.risk_review, cached: true };
  }
  const review = await reviewSignalRisk(signal, { locale: opts.locale });
  await saveGoldSignalRiskReview(id, review);
  return { review, cached: false };
}
