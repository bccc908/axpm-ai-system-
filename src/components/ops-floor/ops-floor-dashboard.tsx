"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OpsFloorPanels, RemindersPanel, SystemsPanel, TipsPanel } from "@/components/ops-floor/ops-floor-panels";
import { useLocale } from "@/components/providers/locale-provider";
import type { OpsFloorLabels } from "@/lib/ops-floor/apply-live";
import type { OpsFloorSummary } from "@/lib/ops-floor/types";
import "./ops-floor.css";

type NexusHandle = {
  nexus: {
    connectLiveData: (options: {
      url?: string;
      intervalMs?: number;
      getLocale?: () => string;
      getLabels?: () => OpsFloorLabels | null;
      onSummary?: (summary: OpsFloorSummary) => void;
    }) => (() => void) | void;
  };
  dispose: () => void;
  reapplyLocale: () => void;
};

export function OpsFloorDashboard() {
  const { t, locale } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<NexusHandle | null>(null);
  const localeRef = useRef(locale);
  const labelsRef = useRef<OpsFloorLabels | null>(null);
  const [summary, setSummary] = useState<OpsFloorSummary | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ health: HTMLElement; tips: HTMLElement; reminders: HTMLElement } | null>(null);

  const labels: OpsFloorLabels = {
    brand: "AXPM",
    brandSub: t("opsFloor.brandSub"),
    roster: t("opsFloor.roster"),
    hint: t("opsFloor.hint"),
    autoRotate: t("opsFloor.autoRotate"),
    glow: t("opsFloor.glow"),
    reset: t("opsFloor.reset"),
    following: t("opsFloor.following"),
    stopFollow: t("opsFloor.stopFollow"),
    status: t("opsFloor.status"),
    activity: t("opsFloor.activity"),
    agents: t("opsFloor.agents"),
    uptime: t("opsFloor.uptime"),
    cost: t("opsFloor.cost"),
    pending: t("opsFloor.pending"),
    doneToday: t("opsFloor.doneToday"),
    openSignals: t("opsFloor.openSignals"),
    dueReminders: t("opsFloor.dueReminders"),
    teamLine: t("opsFloor.teamLine"),
    breakdown: t("opsFloor.breakdown"),
    liveWord: t("opsFloor.liveWord"),
    sessionWord: t("opsFloor.sessionWord"),
  };
  localeRef.current = locale;
  labelsRef.current = labels;

  useEffect(() => {
    handleRef.current?.reapplyLocale();
  }, [locale]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const { mountNexus } = await import("./nexus-engine");
        if (disposed || !rootRef.current) return;
        const handle = mountNexus(rootRef.current, labelsRef.current) as NexusHandle;
        if (disposed) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
        const health = rootRef.current.querySelector<HTMLElement>("#ops-health");
        const tips = rootRef.current.querySelector<HTMLElement>("#ops-tips");
        const reminders = rootRef.current.querySelector<HTMLElement>("#ops-reminders");
        if (health && tips && reminders) setSlots({ health, tips, reminders });
        const stop = handle.nexus.connectLiveData({
          url: "/api/ops-floor/summary",
          intervalMs: 10_000,
          getLocale: () => localeRef.current,
          getLabels: () => labelsRef.current,
          onSummary: (next) => {
            if (!disposed) setSummary(next);
          },
        });
        cleanup = () => {
          if (typeof stop === "function") stop();
          handle.dispose();
        };
      } catch (error) {
        if (disposed) return;
        setSceneError(error instanceof Error ? error.message : "scene");
        const pull = async () => {
          try {
            const res = await fetch("/api/ops-floor/summary", { credentials: "include", cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json()) as OpsFloorSummary;
            if (!disposed) setSummary(data);
          } catch {
            /* panels stay on the demo empty state */
          }
        };
        void pull();
        const timer = setInterval(() => void pull(), 10_000);
        cleanup = () => clearInterval(timer);
      }
    })();

    return () => {
      disposed = true;
      cleanup();
      handleRef.current = null;
    };
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:h-full md:min-h-0 md:pb-0">
      <div ref={rootRef} className="ops-floor flex min-h-[70vh] flex-1 flex-col md:min-h-0" />
      {sceneError ? (
        <div className="ops-floor border-t border-[#1a2440] px-4 py-4">
          <p className="ops-empty">{t("opsFloor.sceneError")}</p>
          <OpsFloorPanels summary={summary} />
        </div>
      ) : null}
      {slots ? createPortal(<SystemsPanel summary={summary} />, slots.health) : null}
      {slots ? createPortal(<TipsPanel summary={summary} />, slots.tips) : null}
      {slots ? createPortal(<RemindersPanel summary={summary} />, slots.reminders) : null}
    </div>
  );
}
