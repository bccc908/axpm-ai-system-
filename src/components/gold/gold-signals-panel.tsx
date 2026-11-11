"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bitcoin, Hexagon, TrendingUp, Waves } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { GoldDeskProvider } from "@/components/gold/gold-desk-context";
import { GoldDeskMainView } from "@/components/gold/gold-desk-main-view";
import { GoldDeskToolbar } from "@/components/gold/gold-desk-toolbar";
import type { DeskView, HeatmapMode } from "@/components/gold/gold-desk-types";
import { GoldPriceLadder } from "@/components/gold/gold-price-ladder";
import { GoldSignalHistory } from "@/components/gold/gold-signal-history";
import { GoldSignalSidebar } from "@/components/gold/gold-signal-sidebar";
import { SignalRiskReviewCard } from "@/components/gold/signal-risk-review-card";
import { GoldTickerStrip } from "@/components/gold/gold-ticker-strip";
import { HyperliquidAccountCard } from "@/components/gold/hyperliquid-account-card";
import { PageHeader } from "@/components/ui/page-header";
import {
  SIGNAL_INSTRUMENTS,
  type DeskSignal,
  type SignalInstrument,
} from "@/lib/market-signals/instruments";
import { cn } from "@/lib/utils";

const INSTRUMENTS: SignalInstrument[] = ["gold", "xau", "spread", "btc", "eth", "hl"];

function MarketSignalsDesk({ instrument }: { instrument: SignalInstrument }) {
  const { t, locale } = useLocale();
  const config = SIGNAL_INSTRUMENTS[instrument];
  const i18nNs = config.i18nNs;
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
      const res = await fetch(`${config.apiBase}?limit=20`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as
        | { signals?: DeskSignal[]; error?: string }
        | null;
      if (res.ok) {
        setSignals(data?.signals ?? []);
        return;
      }
      setMessage(data?.error || t(`${i18nNs}.loadFailed`));
    } catch {
      setMessage(t(`${i18nNs}.loadFailed`));
    } finally {
      setLoading(false);
    }
  }, [config.apiBase, i18nNs, t]);

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
      const data = (await res.json().catch(() => null)) as {
        automation?: { daily_telegram_enabled: boolean };
        error?: string;
      } | null;
      if (res.ok && data?.automation) {
        setDailyEnabled(data.automation.daily_telegram_enabled);
        setMessage(
          data.automation.daily_telegram_enabled
            ? t(`${i18nNs}.dailyEnabled`)
            : t(`${i18nNs}.dailyDisabled`),
        );
      } else {
        setMessage(data?.error ?? t(`${i18nNs}.generateFailed`));
      }
    } catch {
      setMessage(t(`${i18nNs}.generateFailed`));
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
    <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 md:px-6 lg:px-8">
      <PageHeader
        badge={config.badge}
        title={t(`${i18nNs}.title`)}
        subtitle={t(`${i18nNs}.desc`)}
        icon={
          instrument === "btc" ? (
            <Bitcoin className="h-4 w-4 text-accent" />
          ) : instrument === "eth" ? (
            <Hexagon className="h-4 w-4 text-accent" />
          ) : instrument === "hl" ? (
            <Waves className="h-4 w-4 text-accent" />
          ) : (
            <TrendingUp className="h-4 w-4 text-accent" />
          )
        }
        className="mb-0 shrink-0 border-b-0 pb-0 [&_h1]:text-xl md:[&_h1]:text-2xl [&_p]:mt-0.5"
      />

      <GoldTickerStrip latest={latest} prev={prev} />
      {instrument === "hl" ? <HyperliquidAccountCard /> : null}

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

      <div className="grid min-w-0 shrink-0 grid-cols-1 gap-3 lg:h-[max(36rem,calc(100dvh-7rem))] lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,13.75rem)_minmax(0,20rem)]">
        <section className="flex h-[max(30rem,80dvh)] min-w-0 flex-col overflow-hidden lg:h-auto lg:min-h-0">
          <GoldDeskMainView
            view={view}
            heatmapMode={heatmapMode}
            signal={latest}
            loading={loading}
            i18nNs={i18nNs}
          />
        </section>
        <section className="hidden min-h-0 min-w-0 overflow-hidden xl:flex xl:flex-col">
          <GoldPriceLadder signal={latest} orderFlowMode={view === "orderflow"} />
        </section>
        <aside className="relative z-0 isolate flex min-h-0 min-w-0 flex-col gap-3 overflow-x-hidden lg:overflow-hidden">
          <div className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto">
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
              afterTradePlan={
                instrument === "gold" && latest ? (
                  <SignalRiskReviewCard key={latest.id} signal={latest} />
                ) : null
              }
            />
          </div>
          <GoldSignalHistory
            i18nNs={i18nNs}
            signals={signals}
            onSelect={(s) => setSignals((prev) => [s, ...prev.filter((x) => x.id !== s.id)])}
            className="max-h-[22rem] min-h-[10rem] shrink-0 lg:h-[min(22rem,42%)]"
          />
        </aside>
      </div>

      <p className="shrink-0 pb-1 text-[10px] leading-relaxed text-muted/70">{t(`${i18nNs}.disclaimer`)}</p>
    </div>
  );
}

export function GoldSignalsPanel() {
  const { t } = useLocale();
  const search = useSearchParams();
  const tab = search.get("tab");
  const initial = INSTRUMENTS.find((id) => id === tab) ?? "gold";
  const [instrument, setInstrument] = useState<SignalInstrument>(initial);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap gap-0 border-b border-card-border bg-surface px-4 md:px-6 lg:px-8">
        {INSTRUMENTS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setInstrument(id)}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
              instrument === id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t(SIGNAL_INSTRUMENTS[id].tabKey)}
          </button>
        ))}
      </div>
      <GoldDeskProvider key={instrument} instrument={instrument}>
        <MarketSignalsDesk instrument={instrument} />
      </GoldDeskProvider>
    </div>
  );
}
