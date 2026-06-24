"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGoldDesk } from "@/components/gold/gold-desk-context";
import { GoldOrderFlowByPrice } from "@/components/gold/gold-order-flow";
import { buildPriceLadder } from "@/components/gold/gold-desk-types";
import { cn } from "@/lib/utils";
import type { GoldSignal } from "@/types/gold-signal";

export function GoldPriceLadder({
  signal,
  orderFlowMode,
}: {
  signal: GoldSignal | null;
  orderFlowMode: boolean;
}) {
  const { t } = useLocale();
  const { livePrice } = useGoldDesk();
  const ladder = useMemo(
    () => buildPriceLadder(signal, livePrice),
    [signal, livePrice],
  );

  return (
    <div className="gold-desk-panel hidden flex-col overflow-hidden xl:flex">
      <div className="gold-desk-panel-header">
        <span>{orderFlowMode ? t("goldSignals.orderFlowByPrice") : t("goldSignals.priceLadder")}</span>
        <span className="font-mono normal-case tracking-normal text-muted">
          {orderFlowMode ? t("goldSignals.orderFlowCluster") : t("goldSignals.ladderSimulated")}
        </span>
      </div>
      {orderFlowMode ? (
        <>
          <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-white/[0.04] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted">
            <span className="text-sky-400">{t("goldSignals.orderFlowBuy")}</span>
            <span className="text-right text-rose-400">{t("goldSignals.orderFlowSell")}</span>
          </div>
          <GoldOrderFlowByPrice signal={signal} />
        </>
      ) : (
        <>
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] gap-1 border-b border-white/[0.04] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted">
            <span className="text-right">{t("goldSignals.bid")}</span>
            <span className="px-2 text-center">{t("goldSignals.price")}</span>
            <span>{t("goldSignals.ask")}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px]">
            {ladder.length === 0 ? (
              <p className="p-6 text-center text-muted">—</p>
            ) : (
              ladder.map((row) => (
                <div
                  key={row.price}
                  className={cn(
                    "grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-white/[0.03] py-0.5",
                    row.isSpot && "bg-accent/8",
                    row.tag && "bg-white/[0.03]",
                  )}
                >
                  <div className="relative flex h-6 items-center justify-end pr-1.5">
                    <div
                      className="absolute inset-y-0.5 right-0 rounded-l bg-[#00b4ff]/55"
                      style={{ width: `${row.bidPct}%` }}
                    />
                    <span className="relative z-10 tabular-nums font-medium text-[#66e0ff]">{row.bidSize}</span>
                  </div>
                  <div
                    className={cn(
                      "flex min-w-[4.5rem] flex-col items-center px-1.5 py-0.5",
                      row.isSpot && "font-bold text-accent",
                      row.tag && !row.isSpot && "text-foreground",
                    )}
                  >
                    <span className="tabular-nums">{row.price.toFixed(2)}</span>
                    {row.tag ? (
                      <span className="text-[8px] font-bold uppercase tracking-wide text-accent">{row.tag}</span>
                    ) : null}
                  </div>
                  <div className="relative flex h-6 items-center pl-1.5">
                    <div
                      className="absolute inset-y-0.5 left-0 rounded-r bg-[#ff3355]/55"
                      style={{ width: `${row.askPct}%` }}
                    />
                    <span className="relative z-10 tabular-nums font-medium text-[#ff6677]">{row.askSize}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
