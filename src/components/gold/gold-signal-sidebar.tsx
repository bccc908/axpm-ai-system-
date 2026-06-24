"use client";

import { useState } from "react";
import {
  ChevronRight,
  Layers,
  Loader2,
  Radio,
  ShieldAlert,
  Target,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import {
  formatSignalTime,
} from "@/components/gold/gold-desk-types";
import { computeRiskReward } from "@/lib/gold-signals/chart-math";
import { cn } from "@/lib/utils";
import type { GoldSignal } from "@/types/gold-signal";

export function GoldSignalSidebar({
  latest,
  notes,
  message,
  generating,
  dailyEnabled,
  lastDailySent,
  telegramConfigured,
  dailyBusy,
  onNotesChange,
  onDailyToggle,
  onDailySendNow,
}: {
  latest: GoldSignal | null;
  notes: string;
  message: string | null;
  generating: boolean;
  dailyEnabled: boolean;
  lastDailySent: string | null;
  telegramConfigured: boolean;
  dailyBusy: boolean;
  onNotesChange: (v: string) => void;
  onDailyToggle: () => void;
  onDailySendNow: () => void;
}) {
  const { t, locale } = useLocale();
  const [showSetup, setShowSetup] = useState(false);
  const rr = latest ? computeRiskReward(latest) : null;

  return (
    <div className="flex flex-col gap-3">
      {latest ? (
        <>
          <div className="gold-desk-panel gold-trade-plan p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="gold-trade-plan-title">{t("goldSignals.tradeSetup")}</p>
              <span className="shrink-0 font-mono text-[11px] text-muted/90">
                {formatSignalTime(latest.created_at, locale)}
              </span>
            </div>
            <p className="gold-trade-plan-thesis">{latest.thesis}</p>
            <TradePlanLevelRail signal={latest} />
            {latest.take_profit.length > 0 || rr ? (
              <details className="mt-4 group">
                <summary className="cursor-pointer list-none text-[10px] font-medium uppercase tracking-wider text-muted/80 transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                  {locale === "zh" ? "目标 · 风报" : "Targets · R:R"}
                </summary>
                <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                  {latest.take_profit.length > 0 ? (
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-amber-300/80">TP</span>
                      <span className="tabular-nums text-amber-200">
                        {latest.take_profit.map((p) => p.toFixed(2)).join(" · ")}
                      </span>
                    </div>
                  ) : null}
                  {rr ? (
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-muted">{t("goldSignals.riskReward")}</span>
                      <span className="text-foreground">
                        1:{rr.rewards[0]?.toFixed(2)}
                        {rr.rewards[1] != null ? (
                          <span className="text-muted"> / 1:{rr.rewards[1].toFixed(2)}</span>
                        ) : null}
                        <span className="ml-2 text-muted">({rr.risk.toFixed(1)} pts)</span>
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-muted">{t("goldSignals.confidence")}</span>
                    <span className="text-foreground">{latest.confidence}%</span>
                  </div>
                </div>
              </details>
            ) : null}
          </div>

          {latest.orderflow_triggers.length > 0 ? (
            <div className="gold-desk-panel p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
                <Target className="h-3 w-3" />
                {t("goldSignals.triggers")}
              </p>
              <ul className="mt-3 space-y-2">
                {latest.orderflow_triggers.map((item, i) => (
                  <li
                    key={item}
                    className="flex gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-xs leading-relaxed text-muted"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-accent/70">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="gold-desk-panel border-amber-500/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/90">
              {t("goldSignals.tapePlaybook")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted whitespace-pre-wrap">
              {latest.bookmap_playbook}
            </p>
          </div>

          {latest.invalidation ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-rose-300/80">
                  {t("goldSignals.invalidation")}
                </p>
                <p className="mt-1 text-xs text-muted">{latest.invalidation}</p>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="gold-desk-panel flex flex-col items-center justify-center p-8 text-center">
          <Layers className="mb-3 h-8 w-8 text-muted/40" />
          <p className="text-sm text-muted">{t("goldSignals.empty")}</p>
        </div>
      )}

      <DailyAutomationCard
        dailyEnabled={dailyEnabled}
        lastDailySent={lastDailySent}
        telegramConfigured={telegramConfigured}
        dailyBusy={dailyBusy}
        onToggle={onDailyToggle}
        onSendNow={onDailySendNow}
      />

      <div className="gold-desk-panel p-4">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {t("goldSignals.notes")}
        </label>
        <textarea
          className="input-premium mt-2 min-h-[80px] w-full resize-none rounded-xl px-3 py-2.5 font-mono text-xs"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t("goldSignals.notesPlaceholder")}
          disabled={generating}
        />
        {message ? (
          <p className="mt-2 rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1.5 text-[11px] text-accent">
            {message}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setShowSetup((v) => !v)}
        className="flex items-center gap-1 text-left text-[11px] text-muted transition-colors hover:text-accent"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showSetup && "rotate-90")} />
        {t("goldSignals.atasTitle")}
      </button>
      {showSetup ? (
        <div className="gold-desk-panel space-y-3 p-4 text-[11px] leading-relaxed text-muted">
          <p>{t("goldSignals.atasTelegramHint")}</p>
          <p className="border-t border-white/[0.06] pt-3">{t("goldSignals.atasDesc")}</p>
        </div>
      ) : null}
    </div>
  );
}

function DailyAutomationCard({
  dailyEnabled,
  lastDailySent,
  telegramConfigured,
  dailyBusy,
  onToggle,
  onSendNow,
}: {
  dailyEnabled: boolean;
  lastDailySent: string | null;
  telegramConfigured: boolean;
  dailyBusy: boolean;
  onToggle: () => void;
  onSendNow: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="gold-desk-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
            {t("goldSignals.dailyTitle")}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{t("goldSignals.dailyDesc")}</p>
        </div>
        <button
          type="button"
          disabled={dailyBusy}
          onClick={onToggle}
          className={cn(
            "shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold",
            dailyEnabled
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-white/10 bg-white/[0.03] text-muted",
          )}
        >
          {dailyEnabled ? t("goldSignals.dailyEnabled") : t("goldSignals.dailyDisabled")}
        </button>
      </div>
      {!telegramConfigured ? (
        <p className="mt-2 text-[11px] text-amber-300/90">{t("goldSignals.dailyTelegramMissing")}</p>
      ) : (
        <p className="mt-2 font-mono text-[10px] text-muted">
          {t("goldSignals.dailyLastSent")}:{" "}
          <span className="text-foreground">{lastDailySent ?? t("goldSignals.dailyNotSent")}</span>
        </p>
      )}
      <button
        type="button"
        disabled={dailyBusy || !telegramConfigured}
        onClick={onSendNow}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/15 disabled:opacity-50"
      >
        {dailyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
        {dailyBusy ? t("goldSignals.dailySending") : t("goldSignals.dailySendNow")}
      </button>
      <p className="mt-2 text-[10px] text-muted/80">{t("goldSignals.dailyCronHint")}</p>
    </div>
  );
}

function TradePlanLevelRail({ signal }: { signal: GoldSignal }) {
  const levels: Array<{ label: string; price: number; tone: string }> = [];

  if (signal.stop_loss != null) {
    levels.push({ label: "STOP", price: signal.stop_loss, tone: "text-rose-400" });
  }
  if (signal.entry_zone) {
    const entry =
      Math.abs(signal.entry_zone.high - signal.entry_zone.low) < 0.05
        ? signal.entry_zone.high
        : (signal.entry_zone.low + signal.entry_zone.high) / 2;
    levels.push({ label: "ENTRY", price: entry, tone: "text-emerald-400" });
  }

  levels.sort((a, b) => b.price - a.price);

  if (levels.length === 0) return null;

  return (
    <div className="gold-level-rail">
      {levels.map((lv) => (
        <div key={`${lv.label}-${lv.price}`} className={cn("gold-level-row", lv.tone)}>
          <span className="text-[11px] font-bold uppercase tracking-wide">{lv.label}</span>
          <span className="gold-level-line" aria-hidden />
          <span className="tabular-nums text-[13px] font-semibold">{lv.price.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
