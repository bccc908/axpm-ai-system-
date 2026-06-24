"use client";

import type { ComparisonPlan } from "@/lib/ai/market-comparison-types";

const DEFAULT_COLORS = ["#d97706", "#ca8a04", "#be123c", "#e11d48", "#2563eb", "#059669"];

function columnColor(color: string | undefined, index: number) {
  if (color) return color.startsWith("#") ? color : `#${color}`;
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return { r: 100, g: 116, b: 139 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function tierGradient(base: string, index: number, total: number) {
  const { r, g, b } = hexToRgb(base);
  const depth = total <= 1 ? 0 : index / (total - 1);
  const lift = 0.08 + depth * 0.14;
  const r2 = Math.min(255, Math.round(r + (255 - r) * lift));
  const g2 = Math.min(255, Math.round(g + (255 - g) * lift));
  const b2 = Math.min(255, Math.round(b + (255 - b) * lift));
  return `linear-gradient(145deg, rgb(${r2},${g2},${b2}) 0%, rgb(${r},${g},${b}) 100%)`;
}

export function ComparisonLadder({
  plan,
  compact,
}: {
  plan: ComparisonPlan;
  compact?: boolean;
}) {
  const maxTiers = Math.max(...plan.columns.map((c) => c.tiers.length), 1);
  const tierCount = plan.columns.reduce((n, c) => n + c.tiers.length, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-xl">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-5 py-4 text-center sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
          Tier Comparison
        </p>
        <h3 className="mt-1.5 text-lg font-bold tracking-tight text-white sm:text-xl">
          {plan.title}
        </h3>
        {plan.subtitle && (
          <p className="mt-1 text-xs text-slate-400">{plan.subtitle}</p>
        )}
        <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      </div>

      {/* Ladder grid */}
      <div className={`px-3 py-4 sm:px-5 ${compact ? "min-h-[300px]" : "min-h-[380px]"}`}>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:gap-2.5">
          {plan.columns.map((col, ci) => {
            const base = columnColor(col.color, ci);
            const pad = maxTiers - col.tiers.length;

            return (
              <div
                key={`${col.name}-${ci}`}
                className="flex min-w-[108px] flex-1 flex-col sm:min-w-[128px]"
              >
                {/* Column header */}
                <div
                  className="relative mb-2 rounded-lg px-2 py-2.5 text-center shadow-md ring-1 ring-white/15"
                  style={{ background: tierGradient(base, 0, 1) }}
                >
                  <p className="text-[11px] font-bold leading-tight text-white sm:text-xs">
                    {col.name}
                  </p>
                </div>

                {/* Tiers */}
                <div className="flex flex-1 flex-col gap-1.5">
                  {col.tiers.map((tier, ti) => (
                    <div
                      key={`${tier.level}-${ti}`}
                      className="relative flex min-h-[52px] flex-col justify-center rounded-lg px-2 py-2 text-center shadow-sm ring-1 ring-white/10 transition-transform hover:scale-[1.02]"
                      style={{ background: tierGradient(base, ti, col.tiers.length) }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/95">
                        {tier.level}
                      </p>
                      {tier.title && (
                        <p className="mt-0.5 line-clamp-1 text-[9px] leading-tight text-white/80">
                          {tier.title}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-bold tabular-nums leading-tight text-white">
                        {tier.value}
                      </p>
                      {tier.note && (
                        <p className="mt-0.5 text-[9px] leading-tight text-white/70">
                          {tier.note}
                        </p>
                      )}
                    </div>
                  ))}

                  {Array.from({ length: pad }).map((_, pi) => (
                    <div
                      key={`pad-${pi}`}
                      className="min-h-[52px] rounded-lg border border-dashed border-slate-700/40 bg-slate-800/20"
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/50 bg-slate-950/80 px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
        <span>
          {plan.columns.length} 平台 · {tierCount} 档位
        </span>
        <span className="font-medium tracking-wide text-slate-600">
          信号旗 Market AI
        </span>
      </div>
    </div>
  );
}
