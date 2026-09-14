"use client";

import { Clock, TrendingUp } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGoldDesk } from "@/components/gold/gold-desk-context";
import { BIAS_STYLE, formatPrice } from "@/components/gold/gold-desk-types";
import type { DeskSignal } from "@/lib/market-signals/instruments";
import { cn } from "@/lib/utils";

export function GoldTickerStrip({
  latest,
  prev,
}: {
  latest: DeskSignal | null;
  prev: DeskSignal | null;
}) {
  const { t } = useLocale();
  const { livePrice, changePct, clock, updatedAt, badge, dataSource, flashKey, wsConnected, instrument, spreadLive } =
    useGoldDesk();

  const displayPrice = livePrice ?? latest?.spot_price ?? null;
  const biasStyle = latest ? BIAS_STYLE[latest.bias] : null;
  const BiasIcon = biasStyle?.icon ?? TrendingUp;

  const signalDelta =
    latest?.spot_price != null && prev?.spot_price != null
      ? latest.spot_price - prev.spot_price
      : null;

  const ago =
    updatedAt != null
      ? Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000))
      : null;
  void clock;

  const spread = spreadLive ?? latest?.spread ?? null;
  const leaderKey =
    spread?.leader === "xauusdt"
      ? "spreadSignals.leaderUsdt"
      : spread?.leader === "xauusd"
        ? "spreadSignals.leaderUsd"
        : "spreadSignals.leaderAligned";

  return (
    <div className="gold-ticker-strip flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-5">
      {instrument === "spread" && spread ? (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{t("spreadSignals.xauusd")}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground md:text-3xl">
              ${formatPrice(spread.xauusd)}
            </p>
            {spread.xauusd_change_pct != null ? (
              <p className={cn("font-mono text-xs", spread.xauusd_change_pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {spread.xauusd_change_pct >= 0 ? "+" : ""}
                {spread.xauusd_change_pct.toFixed(2)}%
              </p>
            ) : null}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{t("spreadSignals.xauusdt")}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground md:text-3xl">
              ${formatPrice(spread.xauusdt)}
            </p>
            {spread.xauusdt_change_pct != null ? (
              <p className={cn("font-mono text-xs", spread.xauusdt_change_pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {spread.xauusdt_change_pct >= 0 ? "+" : ""}
                {spread.xauusdt_change_pct.toFixed(2)}%
              </p>
            ) : null}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{t("spreadSignals.spread")}</p>
            <p
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums md:text-3xl",
                spread.spread >= 0 ? "text-amber-300" : "text-sky-300",
              )}
            >
              {spread.spread >= 0 ? "+" : ""}
              {spread.spread.toFixed(2)}
            </p>
            <p className="text-[11px] text-muted">
              {spread.spread >= 0 ? t("spreadSignals.premium") : t("spreadSignals.discount")} · {t(leaderKey)}
            </p>
          </div>
        </div>
      ) : (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {wsConnected ? "WS LIVE" : "LIVE"}
        </span>
        <span
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground transition-colors duration-300 md:text-4xl",
            flashKey > 0 && "text-accent",
          )}
          key={flashKey}
        >
          {displayPrice != null ? `$${formatPrice(displayPrice)}` : "—"}
        </span>
        {changePct != null ? (
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              changePct >= 0 ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {changePct >= 0 ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        ) : signalDelta != null ? (
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              signalDelta >= 0 ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {signalDelta >= 0 ? "+" : ""}
            {signalDelta.toFixed(2)}
          </span>
        ) : null}
        {ago != null ? (
          <span className="font-mono text-[10px] text-muted/80">
            {t("goldSignals.orderFlowUpdated", { sec: String(ago) })}
          </span>
        ) : null}
      </div>
      )}

      <div className="flex flex-wrap items-center gap-3 md:ml-auto">
        {latest ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                biasStyle?.pill,
              )}
            >
              <BiasIcon className="h-3.5 w-3.5" />
              {t(`goldSignals.bias.${latest.bias}`)}
            </span>
            <span className="text-[11px] text-muted">
              {t("goldSignals.confidence")}{" "}
              <span className="font-mono font-semibold text-accent">{latest.confidence}%</span>
            </span>
            <span className="hidden items-center gap-1 text-[11px] text-muted sm:inline-flex">
              <Clock className="h-3 w-3" />
              {latest.timeframe}
            </span>
          </>
        ) : null}
        <span className="font-mono text-[10px] text-muted/80">{badge} · {dataSource}</span>
      </div>
    </div>
  );
}
