"use client";

import { useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";

const INSTRUMENTS = [
  { id: "gold", label: "goldSignals.tabGold", symbol: "XAUUSD" },
  { id: "xau", label: "goldSignals.tabXau", symbol: "XAUUSDT" },
  { id: "spread", label: "goldSignals.tabSpread", symbol: "USD vs USDT" },
  { id: "btc", label: "goldSignals.tabBtc", symbol: "BTCUSD" },
  { id: "eth", label: "goldSignals.tabEth", symbol: "ETHUSD" },
  { id: "hl", label: "goldSignals.tabHl", symbol: "BTC-PERP" },
] as const;

export function CustomerGoldSignals() {
  const { t } = useLocale();
  const [instrument, setInstrument] = useState<(typeof INSTRUMENTS)[number]["id"]>("gold");
  const [refreshed, setRefreshed] = useState(false);
  const symbol = INSTRUMENTS.find((item) => item.id === instrument)?.symbol ?? "XAUUSD";

  return (
    <section aria-label={t("customerAi.goldTitle")}>
      <div className="cq-head-row">
        <div>
          <p className="cq-kicker">{t("customerAi.goldKicker")}</p>
          <h1 className="cq-title">{t("customerAi.goldTitle")}</h1>
          <p className="cq-sub">{t("customerAi.goldSubtitle")}</p>
        </div>
        <button type="button" className="cq-btn-quiet" aria-pressed={refreshed} onClick={() => setRefreshed(true)}>
          {t("goldSignals.refresh")}
        </button>
      </div>
      <div className="cq-instruments" role="tablist">
        {INSTRUMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={instrument === item.id}
            className={instrument === item.id ? "cq-instrument is-active" : "cq-instrument"}
            onClick={() => setInstrument(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className="cq-spot">
        <span>{t("goldSignals.spot")}</span>
        <b>{t("customerAi.spotValue")}</b>
        <span>
          {symbol} · {t("customerAi.updated")}
        </span>
      </div>
      <article className="cq-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <p className="cq-card-kicker">{t("customerAi.latest")}</p>
          <span className="cq-badge">{t("customerAi.previewExample")}</span>
        </div>
        <div className="cq-pills-row">
          <span className="cq-signal-pill">{t("goldSignals.bias.wait")}</span>
          <span className="cq-signal-pill quiet">{t("goldSignals.bias.neutral")}</span>
          <span className="cq-signal-pill quiet">{t("goldSignals.strength.moderate")}</span>
          <span className="cq-signal-pill quiet">{t("goldSignals.confidence")} {t("customerAi.confidenceValue")}</span>
          <span className="cq-signal-pill quiet">{t("goldSignals.timeframe")} {t("customerAi.timeframeValue")}</span>
        </div>
        <div className="cq-levels">
          <div>
            <small>{t("goldSignals.entry")}</small>
            <strong>{t("customerAi.entryValue")}</strong>
          </div>
          <div>
            <small>{t("goldSignals.stop")}</small>
            <strong>{t("customerAi.stopValue")}</strong>
          </div>
          <div>
            <small>{t("goldSignals.targets")}</small>
            <strong>{t("customerAi.targetsValue")}</strong>
          </div>
          <div>
            <small>{t("goldSignals.invalidation")}</small>
            <strong>{t("customerAi.invalidationValue")}</strong>
          </div>
        </div>
        <p className="cq-thesis">{t("customerAi.thesis")}</p>
      </article>
      <div className="cq-card cq-history">
        <h3>{t("goldSignals.history")}</h3>
        <div className="cq-hist">
          <span>{t("customerAi.hist1")}</span>
          <span>{t("customerAi.hist1meta")}</span>
        </div>
        <div className="cq-hist">
          <span>{t("customerAi.hist2")}</span>
          <span>{t("customerAi.hist2meta")}</span>
        </div>
      </div>
      <p className="cq-disclaimer">{t("goldSignals.disclaimer")}</p>
    </section>
  );
}
