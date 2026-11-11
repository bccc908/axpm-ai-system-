"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { BIAS_STYLE, formatSignalTime } from "@/components/gold/gold-desk-types";
import { cn } from "@/lib/utils";
import type { DeskSignal, SignalI18nNs } from "@/lib/market-signals/instruments";

export function GoldSignalHistory({
  signals,
  onSelect,
  i18nNs = "goldSignals",
  className,
}: {
  signals: DeskSignal[];
  onSelect: (signal: DeskSignal) => void;
  i18nNs?: SignalI18nNs;
  className?: string;
}) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(true);
  const past = signals.slice(1);

  if (past.length === 0) return null;

  return (
    <div
      className={cn(
        "gold-desk-panel relative z-0 isolate flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="gold-desk-panel-header w-full min-w-0 shrink-0 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")}
          />
          <span className="truncate">
            {t(`${i18nNs}.history`)} ({past.length})
          </span>
        </span>
      </button>
      {open ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain divide-y divide-white/[0.04]">
          {past.map((s) => {
            const style = BIAS_STYLE[s.bias];
            const expired =
              s.expires_at != null && Number.isFinite(Date.parse(s.expires_at))
                ? Date.parse(s.expires_at) <= Date.now()
                : false;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s)}
                className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className={cn(
                    "w-10 shrink-0 font-mono text-[10px] font-bold uppercase",
                    style.accent,
                  )}
                >
                  {t(`goldSignals.bias.${s.bias}`)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs leading-5 text-foreground/90">
                  {s.thesis.split("\n")[0]}
                </span>
                {expired ? (
                  <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-muted">
                    {locale === "zh" ? "已过期" : "Expired"}
                  </span>
                ) : null}
                <span className="shrink-0 font-mono text-[10px] text-muted">
                  {formatSignalTime(s.created_at, locale)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
