"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
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
import type { GoldSignal } from "@/types/gold-signal";

function GoldSignalsDesk() {
  const { t, locale } = useLocale();
  const [signals, setSignals] = useState<GoldSignal[]>([]);
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
      const res = await fetch("/api/gold-signals?limit=12");
      const data = await res.json();
      if (res.ok) setSignals(data.signals ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAutomation = useCallback(async () => {
    try {
      const res = await fetch("/api/gold-signals/automation");
      const data = await res.json();
      if (res.ok && data.automation) {
        setDailyEnabled(data.automation.daily_telegram_enabled);
        setLastDailySent(data.automation.last_daily_sent ?? null);
        setTelegramConfigured(data.telegram_configured ?? true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAutomation();
  }, [load, loadAutomation]);

  async function handleDailyToggle() {
    setDailyBusy(true);
    try {
      const res = await fetch("/api/gold-signals/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_telegram_enabled: !dailyEnabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setDailyEnabled(data.automation.daily_telegram_enabled);
        setMessage(
          data.automation.daily_telegram_enabled
            ? t("goldSignals.dailyEnabled")
            : t("goldSignals.dailyDisabled"),
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
      const res = await fetch("/api/gold-signals/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send_now: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("goldSignals.generateFailed"));
        return;
      }
      setDailyEnabled(data.automation.daily_telegram_enabled);
      setLastDailySent(data.automation.last_daily_sent ?? null);
      if (data.result?.signal) {
        setSignals((prev) => [data.result.signal as GoldSignal, ...prev]);
      }
      if (data.result?.partial) setMessage(t("goldSignals.generateOkNoTelegram"));
      else if (data.result?.skipped) setMessage(`${data.result.reason} · ${data.result.today}`);
      else setMessage(t("goldSignals.dailySentOk"));
      void load();
    } catch {
      setMessage(t("goldSignals.generateFailed"));
    } finally {
      setDailyBusy(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/gold-signals/generate", {
        method: "POST",
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
        setMessage(data.error ?? t("goldSignals.generateFailed"));
        return;
      }
      if (data.signal) {
        setSignals((prev) => [data.signal as GoldSignal, ...prev.filter((s) => s.id !== data.signal.id)]);
      }
      if (data.telegram?.ok) setMessage(t("goldSignals.generateOkTelegram"));
      else if (data.telegram && !data.telegram.ok) setMessage(t("goldSignals.generateOkNoTelegram"));
      else setMessage(t("goldSignals.generateOk"));
    } catch {
      setMessage(t("goldSignals.generateFailed"));
    } finally {
      setGenerating(false);
    }
  }

  const latest = signals[0] ?? null;
  const prev = signals[1] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6 lg:px-8">
      <PageHeader
        badge="XAUUSD"
        title={t("goldSignals.title")}
        subtitle={t("goldSignals.desc")}
        icon={<TrendingUp className="h-4 w-4 text-accent" />}
        className="mb-2"
      />

      <GoldTickerStrip latest={latest} prev={prev} />

      <GoldDeskToolbar
        view={view}
        heatmapMode={heatmapMode}
        loading={loading}
        generating={generating}
        onViewChange={setView}
        onHeatmapModeChange={setHeatmapMode}
        onRefresh={() => void load()}
        onGenerate={() => void handleGenerate()}
      />

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px_300px]">
        <GoldDeskMainView view={view} heatmapMode={heatmapMode} signal={latest} loading={loading} />
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
          onNotesChange={setNotes}
          onDailyToggle={() => void handleDailyToggle()}
          onDailySendNow={() => void handleDailySendNow()}
        />
      </div>

      <GoldSignalHistory
        signals={signals}
        onSelect={(s) => setSignals((prev) => [s, ...prev.filter((x) => x.id !== s.id)])}
      />

      <p className="pb-2 text-[10px] leading-relaxed text-muted/70">{t("goldSignals.disclaimer")}</p>
    </div>
  );
}

export function GoldSignalsPanel() {
  return (
    <GoldDeskProvider>
      <GoldSignalsDesk />
    </GoldDeskProvider>
  );
}
