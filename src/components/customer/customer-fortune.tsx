"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { FortuneProfile, FortuneReading, FortuneTopic } from "@/types/fortune";

const TOPICS: { id: FortuneTopic; group: "synthesis" | "life" | "east" | "west" }[] = [
  { id: "combined", group: "synthesis" },
  { id: "daily", group: "synthesis" },
  { id: "custom", group: "synthesis" },
  { id: "career", group: "life" },
  { id: "wealth", group: "life" },
  { id: "love", group: "life" },
  { id: "general", group: "life" },
  { id: "ziwei", group: "east" },
  { id: "meihua", group: "east" },
  { id: "yijing", group: "east" },
  { id: "chenggu", group: "east" },
  { id: "mianxiang", group: "east" },
  { id: "astro", group: "west" },
  { id: "tarot", group: "west" },
  { id: "numerology", group: "west" },
];

type Tab = "read" | "profile" | "history" | "reviews";

const EMPTY_PROFILE: FortuneProfile = { name: null, birth_date: null, birth_time: null, notes: null };

export function CustomerFortune() {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<Tab>("read");
  const [topic, setTopic] = useState<FortuneTopic>("combined");
  const [question, setQuestion] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [profile, setProfile] = useState<FortuneProfile>(EMPTY_PROFILE);
  const [readings, setReadings] = useState<FortuneReading[]>([]);
  const [active, setActive] = useState<FortuneReading | null>(null);
  const [fixture, setFixture] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [profileRes, readingsRes] = await Promise.all([
        fetch(`/api/fortune/profile?locale=${locale}`),
        fetch("/api/fortune/readings"),
      ]);
      if (cancelled) return;
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.profile) setProfile(data.profile);
      }
      if (readingsRes.ok) {
        const data = await readingsRes.json();
        const list = (data.readings ?? []) as FortuneReading[];
        setReadings(list);
        if (list[0]) {
          setActive(list[0]);
          setFixture(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const profileReady = Boolean(profile.name || profile.birth_date || profile.birth_time || profile.notes || saved);

  async function draw(nextQuestion: string, contextId?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fortune/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          question: nextQuestion.trim() || null,
          locale,
          contextReadingId: contextId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "share_required" ? t("fortune.shareGateRequired") : t("fortune.generateFailed"));
        return;
      }
      if (data.reading) {
        setActive(data.reading as FortuneReading);
        setFixture(false);
        if (!data.adviceBlocked && data.reading.id && data.reading.id !== "advice-blocked") {
          setReadings((prev) => [data.reading as FortuneReading, ...prev]);
        }
      }
    } catch {
      setError(t("fortune.generateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch(`/api/fortune/profile?locale=${locale}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      setError(t("fortune.generateFailed"));
      return;
    }
    const data = await res.json();
    if (data.profile) setProfile(data.profile);
    setSaved(true);
    setTab("read");
  }

  function chips(group: (typeof TOPICS)[number]["group"]) {
    return (
      <div className="cq-chips">
        {TOPICS.filter((item) => item.group === group).map((item) => (
          <button
            key={item.id}
            type="button"
            className={topic === item.id ? "cq-chip is-active" : "cq-chip"}
            onClick={() => setTopic(item.id)}
          >
            {t(`fortune.topics.${item.id}`)}
          </button>
        ))}
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "read", label: t("fortune.tabRead") },
    { id: "profile", label: t("fortune.tabProfile") },
    { id: "history", label: t("fortune.tabHistory") },
    { id: "reviews", label: t("fortune.tabReviews") },
  ];

  return (
    <section aria-label={t("nav.fortune")}>
      <p className="cq-kicker">{t("fortune.badge")}</p>
      <h1 className="cq-title">{t("fortune.title")}</h1>
      <p className="cq-sub">{t("fortune.subtitle")}</p>
      {profileReady ? (
        <div className="cq-chip-row">
          <span>{t("customerAi.profileChip")}</span>
          <button type="button" onClick={() => setTab("profile")}>{t("customerAi.editProfile")}</button>
        </div>
      ) : (
        <div className="cq-chip-row">
          <button type="button" onClick={() => setTab("profile")}>{t("customerAi.editProfile")}</button>
        </div>
      )}

      <div className="cq-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "cq-tab is-active" : "cq-tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "read" ? (
        <div className="cq-fortune">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t("fortune.readTitle")}</h2>
            <p className="cq-hint" style={{ marginTop: 4 }}>{t("fortune.readDesc")}</p>
            <p className="cq-label">{t("fortune.synthesisTopics")}</p>
            {chips("synthesis")}
            <p className="cq-hint">{topic === "daily" ? t("fortune.dailyHintShort") : t("fortune.combinedHintShort")}</p>
            <div className="cq-q">
              <label htmlFor="fortune-q">{t("fortune.customQuestion")}</label>
              <textarea
                id="fortune-q"
                className="cq-area"
                value={question}
                placeholder={t("fortune.customPlaceholder")}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </div>
            <button type="button" className="cq-btn" disabled={busy} onClick={() => void draw(question)}>
              <Sparkles className="h-4 w-4" aria-hidden />
              {busy ? t("fortune.generating") : t("fortune.generate")}
            </button>
            <p className="cq-hint">{t("customerAi.ctaHint")}</p>
            {error ? <p className="cq-error">{error}</p> : null}
            <p className="cq-label">{t("fortune.themeTopics")}</p>
            {chips("life")}
            <p className="cq-label">{t("fortune.easternMethodTopics")}</p>
            {chips("east")}
            <p className="cq-label">{t("fortune.westernMethodTopics")}</p>
            {chips("west")}
          </div>
          <article className="cq-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <h3 className="cq-card-kicker">{t("customerAi.resultKicker")}</h3>
              {fixture ? <span className="cq-badge">{t("customerAi.previewExample")}</span> : null}
            </div>
            <p className="cq-hint" style={{ marginTop: 10 }}>{t("fortune.mottoLabel")}</p>
            <p className="cq-motto">{fixture ? t("customerAi.motto") : active?.title}</p>
            <div className="cq-body">
              {fixture ? (
                <>
                  <p>{t("customerAi.reading1")}</p>
                  <p>{t("customerAi.reading2")}</p>
                  <p className="cq-hint">{t("customerAi.readingNote")}</p>
                </>
              ) : (
                <p style={{ whiteSpace: "pre-wrap" }}>{active?.summary || active?.reading}</p>
              )}
            </div>
            <form
              className="cq-follow"
              onSubmit={(event) => {
                event.preventDefault();
                if (!followUp.trim()) return;
                void draw(followUp, active && active.id !== "advice-blocked" ? active.id : undefined);
              }}
            >
              <h3>{t("fortune.askAfterReadingTitle")}</h3>
              <textarea
                className="cq-area"
                value={followUp}
                placeholder={t("fortune.customPlaceholder")}
                onChange={(event) => setFollowUp(event.target.value)}
              />
              <button type="submit" className="cq-btn-quiet" disabled={busy}>{t("fortune.askAfterReadingSubmit")}</button>
            </form>
          </article>
        </div>
      ) : null}

      {tab === "profile" ? (
        <form className="cq-card" onSubmit={(event) => void saveProfile(event)}>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>{t("fortune.profileTitle")}</h2>
          <p className="cq-hint" style={{ marginBottom: 14 }}>{t("fortune.profileDesc")}</p>
          <div className="cq-profile">
            <label>
              <span className="cq-hint">{t("fortune.name")}</span>
              <input className="cq-field" value={profile.name ?? ""} autoComplete="off" onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
            </label>
            <label>
              <span className="cq-hint">{t("fortune.birthDate")}</span>
              <input className="cq-field" value={profile.birth_date ?? ""} autoComplete="off" onChange={(event) => setProfile({ ...profile, birth_date: event.target.value })} />
            </label>
            <label>
              <span className="cq-hint">{t("fortune.birthTime")}</span>
              <input className="cq-field" value={profile.birth_time ?? ""} autoComplete="off" onChange={(event) => setProfile({ ...profile, birth_time: event.target.value })} />
            </label>
            <label className="full">
              <span className="cq-hint">{t("fortune.notes")}</span>
              <textarea className="cq-area" value={profile.notes ?? ""} onChange={(event) => setProfile({ ...profile, notes: event.target.value })} />
            </label>
          </div>
          <button type="submit" className="cq-btn" style={{ width: "auto", marginTop: 16, paddingInline: 18 }}>{t("fortune.saveProfile")}</button>
        </form>
      ) : null}

      {tab === "history" ? (
        readings.length === 0 ? (
          <div className="cq-card cq-empty">{t("customerAi.noHistory")}</div>
        ) : (
          <div className="cq-card cq-history">
            {readings.map((reading) => (
              <button
                key={reading.id}
                type="button"
                className="cq-hist"
                onClick={() => {
                  setActive(reading);
                  setFixture(false);
                  setTab("read");
                }}
              >
                <span>{reading.title}</span>
                <span>{t(`fortune.topics.${reading.topic}`)}</span>
              </button>
            ))}
          </div>
        )
      ) : null}

      {tab === "reviews" ? <div className="cq-card cq-empty">{t("customerAi.reviewsPlaceholder")}</div> : null}
    </section>
  );
}
