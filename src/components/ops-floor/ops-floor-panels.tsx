"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import type { IntegrationHealth, OpsFloorSummary, OpsReminderItem, OpsSignalTip } from "@/lib/ops-floor/types";

function formatWhen(iso: string | null, locale: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPx(value: number) {
  const digits = Math.abs(value) >= 100 ? 2 : 4;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function OpsFloorPanels({ summary }: { summary: OpsFloorSummary | null }) {
  return (
    <>
      <SystemsPanel summary={summary} />
      <TipsPanel summary={summary} />
      <RemindersPanel summary={summary} />
    </>
  );
}

export function SystemsPanel({ summary }: { summary: OpsFloorSummary | null }) {
  const { t, locale } = useLocale();
  if (!summary) return <p className="ops-empty">{t("opsFloor.loading")}</p>;
  return (
    <section className="ops-panel" aria-label={t("opsFloor.systems")}>
      <h2>{t("opsFloor.systems")}</h2>
      <div className="ops-health">
        {summary.integrations.map((item) => (
          <HealthRow key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </section>
  );
}

export function TipsPanel({ summary }: { summary: OpsFloorSummary | null }) {
  const { t, locale } = useLocale();
  if (!summary) return null;
  return (
    <section className="ops-panel" aria-label={t("opsFloor.tipsTitle")}>
      <h2>{t("opsFloor.tipsTitle")}</h2>
      {summary.live ? (
        summary.signals.map((signal) => <SignalCard key={signal.desk} signal={signal} locale={locale} />)
      ) : (
        <div className="ops-card">
          <strong>{t("opsFloor.demoTitle")}</strong>
          <p>{t("opsFloor.demoBody")}</p>
        </div>
      )}
      <p className="ops-disclaimer">{t("opsFloor.disclaimer")}</p>
    </section>
  );
}

function HealthRow({ item, locale }: { item: IntegrationHealth; locale: string }) {
  const name = locale === "zh" ? item.name_zh : item.name_en;
  const detail = locale === "zh" ? item.detail_zh : item.detail_en;
  return (
    <div className={`ops-health-item ${item.status}`} title={detail}>
      <span className="dot" />
      <span>
        {name}
        <span style={{ color: "#4a5672" }}> · {detail}</span>
      </span>
    </div>
  );
}

function SignalCard({ signal, locale }: { signal: OpsSignalTip; locale: string }) {
  const { t } = useLocale();
  const name = locale === "zh" ? signal.name_zh : signal.name_en;
  const biasKey =
    signal.bias === "long"
      ? "opsFloor.biasLong"
      : signal.bias === "short"
        ? "opsFloor.biasShort"
        : signal.bias === "neutral"
          ? "opsFloor.biasNeutral"
          : "opsFloor.biasWait";
  const targets = signal.take_profit.slice(0, 3).map(formatPx).join(" / ");
  return (
    <Link href={signal.href as Route} className="ops-link">
      <article className="ops-card">
        <div className="kicker">
          <span>{name}</span>
          <span>{formatWhen(signal.time, locale)}</span>
        </div>
        <strong>
          {signal.symbol}{" "}
          <span className={`bias-${signal.bias}`}>{signal.time ? t(biasKey) : t("opsFloor.tipsEmpty")}</span>
        </strong>
        {signal.time ? (
          <div className="ops-meta">
            <span>
              {t("opsFloor.entry")} {signal.entry ?? "—"}
            </span>
            <span>
              {t("opsFloor.sl")} {signal.stop_loss != null ? formatPx(signal.stop_loss) : "—"}
            </span>
            <span>
              {t("opsFloor.tp")} {targets || "—"}
            </span>
          </div>
        ) : null}
        {signal.thesis ? <p>{signal.thesis}</p> : null}
      </article>
    </Link>
  );
}

export function RemindersPanel({ summary }: { summary: OpsFloorSummary | null }) {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<"pending" | "done" | "overdue">("pending");
  if (!summary) return null;
  const items = summary.live ? summary.reminders[tab] : [];
  const tabs = [
    ["pending", "opsFloor.pendingTab"],
    ["done", "opsFloor.doneTab"],
    ["overdue", "opsFloor.overdueTab"],
  ] as const;

  return (
    <section className="ops-panel" aria-label={t("opsFloor.remindersTitle")}>
      <h2>{t("opsFloor.remindersTitle")}</h2>
      <div className="ops-tabs">
        {tabs.map(([id, key]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {t(key)}
            {summary.live ? ` ${summary.reminders[id].length}` : ""}
          </button>
        ))}
      </div>
      {summary.live ? (
        items.length ? (
          items.map((item) => <ReminderRow key={`${tab}:${item.id}`} item={item} locale={locale} />)
        ) : (
          <p className="ops-empty">{t("opsFloor.none")}</p>
        )
      ) : (
        <p className="ops-empty">{t("opsFloor.demoBody")}</p>
      )}
    </section>
  );
}

function ReminderRow({ item, locale }: { item: OpsReminderItem; locale: string }) {
  const { t } = useLocale();
  const sourceKey = {
    todo: "opsFloor.sourceTodo",
    job: "opsFloor.sourceJob",
    crm_reminder: "opsFloor.sourceReminder",
    follow_up: "opsFloor.sourceFollowUp",
    team_task: "opsFloor.sourceTeam",
    bill: "opsFloor.sourceBill",
  }[item.source];
  const detail = locale === "zh" ? item.detail_zh : item.detail_en;
  return (
    <Link href={item.href as Route} className="ops-link">
      <article className="ops-card">
        <div className="kicker">
          <span>{t(sourceKey)}</span>
          <span className={item.status === "overdue" ? "tag-overdue" : ""}>{formatWhen(item.due_at, locale)}</span>
        </div>
        <strong>{item.title}</strong>
        <p>{detail}</p>
      </article>
    </Link>
  );
}
