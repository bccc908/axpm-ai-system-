"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";

type CustomerMarketMode = "market" | "data" | "copy";

const MODES: { id: CustomerMarketMode; key: string }[] = [
  { id: "market", key: "marketAi.modeMarket" },
  { id: "data", key: "marketAi.modeData" },
  { id: "copy", key: "marketAi.modeCopy" },
];

export function CustomerMarketAi() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [mode, setMode] = useState<CustomerMarketMode>("market");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [toast, setToast] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = user?.name?.trim() || "Jamie";

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setToast(false);
    try {
      const res = await fetch("/api/customer/market-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message }),
      });
      if (res.ok) {
        setMessages((prev) => [...prev, message]);
        setDraft("");
        setToast(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={t("customerAi.marketTitle")}>
      <p className="cq-kicker">{t("customerAi.marketKicker")}</p>
      <h1 className="cq-title">{t("customerAi.marketTitle")}</h1>
      <p className="cq-sub">{t("customerAi.marketSubtitle")}</p>
      <div className="cq-advisor" style={{ marginTop: 18 }}>
        <div className="cq-advisor-head">
          <strong style={{ fontSize: 14 }}>{t("marketAi.chatTitle")}</strong>
          <div className="cq-modes" role="group" aria-label={t("marketAi.chatTitle")}>
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={mode === item.id ? "cq-chip is-active" : "cq-chip"}
                onClick={() => setMode(item.id)}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
        </div>
        <div className="cq-log">
          <div className="cq-bubble">
            <span className="who">{t("customerAi.assistant")}</span>
            {t("customerAi.welcome", { name })}
          </div>
          {messages.map((message, index) => (
            <div key={`${index}-${message.slice(0, 12)}`} className="cq-bubble">
              <span className="who">{t("customerAi.you")}</span>
              {message}
            </div>
          ))}
        </div>
        <div className="cq-prompts" aria-label={t("customerAi.quickPrompts")}>
          {[t("customerAi.prompt1"), t("customerAi.prompt2")].map((prompt) => (
            <button key={prompt} type="button" className="cq-prompt" onClick={() => setDraft(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <p className="cq-toast" role="status">{toast ? t("customerAi.previewToast") : ""}</p>
        <form
          className="cq-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            className="cq-area"
            value={draft}
            placeholder={t("customerAi.inputPlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="cq-btn" disabled={busy}>
            <ArrowRight className="h-4 w-4" aria-hidden />
            {t("marketAi.send")}
          </button>
        </form>
      </div>
    </section>
  );
}
