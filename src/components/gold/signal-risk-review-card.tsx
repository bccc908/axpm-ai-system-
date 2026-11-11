"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Info, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { formatSignalTime } from "@/components/gold/gold-desk-types";
import type { DeskSignal } from "@/lib/market-signals/instruments";
import { computeDeterministicChecks } from "@/lib/gold-signals/risk-review/checks";
import type { RiskFlag, SignalRiskReview } from "@/lib/gold-signals/risk-review/types";
import { cn } from "@/lib/utils";

const NS = "riskReview";

function Section({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-card-border" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" />
        <span className="flex-1">{title}</span>
        {count != null ? <span className="tabular-nums text-muted/80">{count}</span> : null}
      </summary>
      <div className="pb-3 pl-5 text-xs leading-relaxed text-foreground/90">{children}</div>
    </details>
  );
}

function Bullets({ items, tone }: { items: string[]; tone?: "muted" | "warn" }) {
  if (items.length === 0) return <p className="text-muted">—</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span
            className={cn(
              "mt-[7px] h-1 w-1 shrink-0 rounded-full",
              tone === "warn" ? "bg-warning" : tone === "muted" ? "bg-muted" : "bg-secondary",
            )}
          />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FlagRow({ flag }: { flag: RiskFlag }) {
  const Icon = flag.severity === "info" ? Info : AlertTriangle;
  return (
    <li className="flex gap-2">
      <Icon
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          flag.severity === "critical" ? "text-warning" : flag.severity === "warn" ? "text-warning/80" : "text-muted",
        )}
      />
      <span className={cn("min-w-0 break-words", flag.severity === "critical" && "text-foreground")}>{flag.message}</span>
    </li>
  );
}

function fmt(n: number | null | undefined, digits = 2) {
  return n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits);
}

export function SignalRiskReviewCard({ signal }: { signal: DeskSignal }) {
  const { t, locale } = useLocale();
  const [review, setReview] = useState<SignalRiskReview | null>(signal.risk_review ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      setRunning(true);
      setError(null);
      try {
        const res = await fetch("/api/gold-signals/risk-review", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signal_id: signal.id, force, locale: locale === "zh" ? "zh" : "en" }),
        });
        const data = (await res.json().catch(() => null)) as
          | { review?: SignalRiskReview; error?: string }
          | null;
        if (res.ok && data?.review) setReview(data.review);
        else setError(data?.error ?? t(`${NS}.loadFailed`));
      } catch {
        setError(t(`${NS}.loadFailed`));
      } finally {
        setRunning(false);
      }
    },
    [signal.id, locale, t],
  );

  // Automatic review: use the stored one, otherwise ask the server (cached after first run).
  useEffect(() => {
    if (signal.risk_review) {
      setReview(signal.risk_review);
      return;
    }
    setReview(null);
    // Server returns the stored review if one exists, otherwise runs it once and stores it.
    void run(false);
  }, [signal.id, signal.risk_review, run]);

  // Deterministic checks are always available, even before the server answers.
  const checks = review?.checks ?? computeDeterministicChecks(signal, null);
  const ai = review?.ai ?? null;
  const status = review?.ai_status;
  const context = review?.context ?? null;

  const unavailableTitle =
    status?.state === "unavailable"
      ? status.reason === "insufficient_balance"
        ? t(`${NS}.aiUnavailable`)
        : status.reason === "not_configured"
          ? t(`${NS}.aiNotConfigured`)
          : status.reason === "invalid_output"
            ? t(`${NS}.aiInvalid`)
            : t(`${NS}.aiFailed`)
      : null;

  const verdictTake = ai?.verdict === "take_trade";
  const huntZones = checks.liquidity_zones;

  return (
    <div className="gold-desk-panel min-w-0 overflow-hidden" data-testid="risk-review-card">
      <div className="flex items-center justify-between gap-2 border-b border-card-border px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-muted" />
          {t(`${NS}.title`)}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">
            {t(`${NS}.score`)}{" "}
            <span className="text-sm font-semibold tabular-nums text-foreground">{ai ? `${ai.score}/10` : "—"}</span>
          </span>
          {ai ? (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[11px] font-semibold",
                verdictTake
                  ? "border-secondary/40 bg-secondary/10 text-secondary"
                  : "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              {verdictTake ? t(`${NS}.verdictTake`) : t(`${NS}.verdictStand`)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-md border border-card-border bg-background px-2 py-1.5">
            <p className="text-muted">{t(`${NS}.rr`)}</p>
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                checks.rr_below_min ? "text-warning" : "text-foreground",
              )}
            >
              {checks.primary_r != null ? `1:${fmt(checks.primary_r)}` : "—"}
            </p>
          </div>
          <div className="rounded-md border border-card-border bg-background px-2 py-1.5">
            <p className="text-muted">{t(`${NS}.breakeven`)}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {checks.breakeven_win_rate != null ? `${(checks.breakeven_win_rate * 100).toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="rounded-md border border-card-border bg-background px-2 py-1.5">
            <p className="text-muted">{t(`${NS}.stop`)}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {checks.risk_pts != null ? `${fmt(checks.risk_pts, 1)} pts` : "—"}
            </p>
            {checks.stop_atr_multiple != null ? (
              <p className="tabular-nums text-muted">{t(`${NS}.atrMultiple`, { x: fmt(checks.stop_atr_multiple) })}</p>
            ) : null}
          </div>
        </div>

        {checks.targets.length > 1 ? (
          <p className="mt-2 text-[11px] tabular-nums text-muted">
            {t(`${NS}.targets`)}:{" "}
            {checks.targets.map((tg, i) => (
              <span key={tg.price} className="mr-2">
                TP{i + 1} {fmt(tg.price)} <span className="text-foreground">1:{fmt(tg.r)}</span>
              </span>
            ))}
          </p>
        ) : null}

        {unavailableTitle ? (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2" role="status">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {unavailableTitle}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {status?.state === "unavailable" && status.reason === "insufficient_balance"
                ? t(`${NS}.aiUnavailableDesc`)
                : status?.state === "unavailable"
                  ? status.detail
                  : null}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-[11px] text-danger">{error}</p> : null}

        {ai ? <p className="mt-3 text-xs leading-relaxed text-foreground/90">{ai.summary}</p> : null}
        {ai?.overridden_by_rule ? (
          <p className="mt-1.5 text-[11px] text-warning">{t(`${NS}.overridden`, { rules: ai.overridden_by_rule })}</p>
        ) : null}
      </div>

      <div className="mt-3 px-4">
        <Section title={t(`${NS}.checks`)} count={checks.flags.length} defaultOpen={!ai}>
          {checks.flags.length === 0 ? (
            <p className="text-muted">{t(`${NS}.noFlags`)}</p>
          ) : (
            <ul className="space-y-1.5">
              {checks.flags.map((f) => (
                <FlagRow key={f.code} flag={f} />
              ))}
            </ul>
          )}
        </Section>

        {ai ? (
          <Section title={t(`${NS}.confluence`)}>
            <p className="mb-1 text-[11px] font-medium text-muted">{t(`${NS}.supporting`)}</p>
            <Bullets items={ai.confluence.supporting} />
            <p className="mb-1 mt-2.5 text-[11px] font-medium text-muted">{t(`${NS}.weak`)}</p>
            <Bullets items={ai.confluence.weak_or_forced} tone="warn" />
          </Section>
        ) : null}

        <Section title={t(`${NS}.traps`)} count={huntZones.length}>
          {huntZones.length === 0 ? (
            <p className="text-muted">{t(`${NS}.noZones`)}</p>
          ) : (
            <table className="w-full text-[11px] tabular-nums">
              <tbody>
                {huntZones.map((z) => (
                  <tr key={`${z.kind}-${z.price}`} className="border-b border-card-border/60 last:border-0">
                    <td className="py-1 pr-2 text-foreground">{z.label}</td>
                    <td className="py-1 pr-2 text-right">{fmt(z.price)}</td>
                    <td className="py-1 pr-2 text-right text-muted">
                      {z.distance_from_stop > 0 ? "+" : ""}
                      {fmt(z.distance_from_stop, 1)}
                    </td>
                    <td className="py-1 text-right">
                      {z.stop_hunt_risk ? <span className="text-warning">{t(`${NS}.huntRisk`)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {ai && ai.trap_zones.length > 0 ? (
            <div className="mt-2.5">
              <Bullets
                items={ai.trap_zones.map((z) => `${z.label}${z.price != null ? ` ${fmt(z.price)}` : ""}${z.note ? ` — ${z.note}` : ""}`)}
                tone="warn"
              />
            </div>
          ) : null}
        </Section>

        {ai ? (
          <>
            <Section title={t(`${NS}.devils`)} count={ai.devils_advocate.length}>
              <Bullets items={ai.devils_advocate} tone="warn" />
            </Section>
            <Section title={t(`${NS}.conditions`)} count={ai.conditions.length}>
              <Bullets items={ai.conditions} tone="muted" />
            </Section>
          </>
        ) : null}

        {context ? (
          <Section title={t(`${NS}.context`, { interval: context.interval, source: context.source })}>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular-nums">
              {(
                [
                  ["VWAP", fmt(context.vwap)],
                  ["POC", fmt(context.poc)],
                  ["VAH", fmt(context.vah)],
                  ["VAL", fmt(context.val)],
                  ["Range pos", context.range_pos != null ? `${(context.range_pos * 100).toFixed(0)}%` : "—"],
                  ["ATR(14)", fmt(context.atr14)],
                  ["RSI(14)", fmt(context.rsi14, 1)],
                  ["MACD hist", fmt(context.macd_hist)],
                  ["EMA 9/21", `${fmt(context.ema9)} / ${fmt(context.ema21)}`],
                  ["Δ last 20", context.recent_delta != null ? context.recent_delta.toLocaleString() : "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-card-border px-4 py-2.5">
        <span className="truncate text-[11px] text-muted">
          {review ? t(`${NS}.reviewedAt`, { time: formatSignalTime(review.created_at, locale) }) : ""}
        </span>
        <button
          type="button"
          onClick={() => void run(true)}
          disabled={running}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-card-border bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          {running ? t(`${NS}.running`) : t(`${NS}.rerun`)}
        </button>
      </div>
    </div>
  );
}
