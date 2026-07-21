"use client";

import { useCallback, useEffect, useState } from "react";
import { Bitcoin, TrendingUp } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { GoldDeskProvider } from "@/components/gold/gold-desk-context";
import { GoldDeskMainView } from "@/components/gold/gold-desk-main-view";
import { GoldDeskToolbar } from "@/components/gold/gold-desk-toolbar";
import type { DeskView, HeatmapMode } from "@/components/gold/gold-desk-types";
import { GoldPriceLadder } from "@/components/gold/gold-price-ladder";
import { GoldSignalHistory } from "@/components/gold/gold-signal-history";
import { GoldSignalSidebar } from "@/components/gold/gold-signal-sidebar";
import { GoldTickerStrip } from "@/components/gold/gold-ticker-strip";
import { PageHeader } from "@/components/ui/page-header";
import {
  SIGNAL_INSTRUMENTS,
  type DeskSignal,
  type SignalInstrument,
} from "@/lib/market-signals/instruments";
import { cn } from "@/lib/utils";

const INSTRUMENTS: SignalInstrument[] = ["gold", "btc"];

function MarketSignalsDesk({ instrument }: { instrument: SignalInstrument }) {
  const { t, locale } = useLocale();
  const config = SIGNAL_INSTRUMENTS[instrument];
  const i18nNs = instrument === "btc" ? "btcSignals" : "goldSignals";
  const [signals, setSignals] = useState<DeskSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState("");
  const [timeframe] = useState("M15–H1");
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<DeskView>("chart");
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("heatmap");
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [lastDailySent, setLastDailySent] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(true);
  const [dailyBusy, setDailyBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBase}?limit=12`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setSignals(data.signals ?? []);
    } finally {
      setLoading(false);
    }
  }, [config.apiBase]);

  const loadAutomation = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiBase}/automation`);
      const data = await res.json();
      if (res.ok && data.automation) {
        setDailyEnabled(data.automation.daily_telegram_enabled);
        setLastDailySent(data.automation.last_daily_sent ?? null);
        setTelegramConfigured(data.telegram_configured ?? true);
      }
    } catch {
      /* ignore */
    }
  }, [config.apiBase]);

  useEffect(() => {
    void load();
    void loadAutomation();
  }, [load, loadAutomation]);

  async function handleDailyToggle() {
    setDailyBusy(true);
    try {
      const res = await fetch(`${config.apiBase}/automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_telegram_enabled: !dailyEnabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setDailyEnabled(data.automation.daily_telegram_enabled);
        setMessage(
          data.automation.daily_telegram_enabled
            ? t(`${i18nNs}.dailyEnabled`)
            : t(`${i18nNs}.dailyDisabled`),
        );
      }
    } finally {
      setDailyBusy(false);
    }
  }

  async function handleDailySendNow() {
    setDailyBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${config.apiBase}/automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send_now: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t(`${i18nNs}.generateFailed`));
        return;
      }
      setDailyEnabled(data.automation.daily_telegram_enabled);
      setLastDailySent(data.automation.last_daily_sent ?? null);
      if (data.result?.signal) {
        setSignals((prev) => [data.result.signal as DeskSignal, ...prev]);
      }
      if (data.result?.partial) setMessage(t(`${i18nNs}.generateOkNoTelegram`));
      else if (data.result?.skipped) setMessage(`${data.result.reason} · ${data.result.today}`);
      else setMessage(t(`${i18nNs}.dailySentOk`));
      void load();
    } catch {
      setMessage(t(`${i18nNs}.generateFailed`));
    } finally {
      setDailyBusy(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${config.apiBase}/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          timeframe,
          notes: notes.trim() || undefined,
          include_news: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t(`${i18nNs}.generateFailed`));
        return;
      }
      if (data.signal) {
        setSignals((prev) => [
          data.signal as DeskSignal,
          ...prev.filter((s) => s.id !== data.signal.id),
        ]);
      }
      if (data.telegram?.ok) setMessage(t(`${i18nNs}.generateOkTelegram`));
      else if (data.telegram && !data.telegram.ok) setMessage(t(`${i18nNs}.generateOkNoTelegram`));
      else setMessage(t(`${i18nNs}.generateOk`));
    } catch {
      setMessage(t(`${i18nNs}.generateFailed`));
    } finally {
      setGenerating(false);
    }
  }

  const latest = signals[0] ?? null;
  const prev = signals[1] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6 lg:px-8">
      <PageHeader
        badge={config.badge}
        title={t(`${i18nNs}.title`)}
        subtitle={t(`${i18nNs}.desc`)}
        icon={
          instrument === "btc" ? (
            <Bitcoin className="h-4 w-4 text-accent" />
          ) : (
            <TrendingUp className="h-4 w-4 text-accent" />
          )
        }
        className="mb-2"
      />

      <GoldTickerStrip latest={latest} prev={prev} />

      <GoldDeskToolbar
        view={view}
        heatmapMode={heatmapMode}
        loading={loading}
        generating={generating}
        i18nNs={i18nNs}
        onViewChange={setView}
        onHeatmapModeChange={setHeatmapMode}
        onRefresh={() => void load()}
        onGenerate={() => void handleGenerate()}
      />

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px_300px]">
        <GoldDeskMainView
          view={view}
          heatmapMode={heatmapMode}
          signal={latest}
          loading={loading}
          i18nNs={i18nNs}
        />
        <GoldPriceLadder signal={latest} orderFlowMode={view === "orderflow"} />
        <GoldSignalSidebar
          latest={latest}
          notes={notes}
          message={message}
          generating={generating}
          dailyEnabled={dailyEnabled}
          lastDailySent={lastDailySent}
          telegramConfigured={telegramConfigured}
          dailyBusy={dailyBusy}
          i18nNs={i18nNs}
          onNotesChange={setNotes}
          onDailyToggle={() => void handleDailyToggle()}
          onDailySendNow={() => void handleDailySendNow()}
        />
      </div>

      <GoldSignalHistory
        i18nNs={i18nNs}
        signals={signals}
        onSelect={(s) => setSignals((prev) => [s, ...prev.filter((x) => x.id !== s.id)])}
      />

      <p className="pb-2 text-[10px] leading-relaxed text-muted/70">{t(`${i18nNs}.disclaimer`)}</p>
    </div>
  );
}

export function GoldSignalsPanel() {
  const { t } = useLocale();
  const [instrument, setInstrument] = useState<SignalInstrument>("gold");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 px-4 pt-4 md:px-6 lg:px-8">
        {INSTRUMENTS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setInstrument(id)}
            className={cn(
              "rounded-xl border px-4 py-2 font-mono text-xs font-semibold tracking-wide transition-colors",
              instrument === id
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
            )}
          >
            {id === "gold" ? t("goldSignals.tabGold") : t("goldSignals.tabBtc")}
          </button>
        ))}
      </div>
      <GoldDeskProvider key={instrument} instrument={instrument}>
        <MarketSignalsDesk instrument={instrument} />
      </GoldDeskProvider>
    </div>
  );
}
