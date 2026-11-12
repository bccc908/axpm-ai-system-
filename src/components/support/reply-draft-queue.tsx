"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Draft = {
  id: string;
  status: "pending_approval" | "approved" | "rejected";
  channel: string;
  clientName: string;
  clientId: string | null;
  customerQuestion: string;
  draftReply: string;
  alternatives: string[];
  provider: string;
  fallback: boolean;
  source: string;
  notifiedTelegram: boolean;
  telegramError: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};

export function ReplyDraftQueue() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/support/drafts");
    const data = (await res.json().catch(() => null)) as
      | { drafts?: Draft[]; error?: string }
      | null;
    if (!res.ok) {
      setError(data && "error" in data && data.error ? String(data.error) : "Failed to load drafts");
      setLoading(false);
      return;
    }
    setDrafts(data?.drafts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/support/drafts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, decidedBy: "kayden" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Decision failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = drafts.filter((d) => d.status === "pending_approval");
  const decided = drafts.filter((d) => d.status !== "pending_approval").slice(0, 10);

  return (
    <section
      id="reply-drafts"
      className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">Reply drafts pending approval</h2>
          <p className="mt-1 text-xs text-muted">
            AI suggestions are stored here for Kayden to review. Approving records the
            decision only — it does not send WhatsApp, WeChat, or a widget reply.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-accent hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted">Loading drafts…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && pending.length === 0 && (
        <p className="text-sm text-muted">No drafts waiting for approval.</p>
      )}

      <ul className="space-y-4">
        {pending.map((draft) => (
          <li
            key={draft.id}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
          >
            <DraftBody draft={draft} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === draft.id}
                onClick={() => void decide(draft.id, "approved")}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Approve (do not send)
              </button>
              <button
                type="button"
                disabled={busyId === draft.id}
                onClick={() => void decide(draft.id, "rejected")}
                className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      {decided.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Recent decisions
          </h3>
          <ul className="space-y-2">
            {decided.map((draft) => (
              <li
                key={draft.id}
                className="rounded-lg border border-white/10 p-3 text-xs text-muted"
              >
                <DraftBody draft={draft} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DraftBody({ draft, compact }: { draft: Draft; compact?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted">
        <span className="font-medium text-white">{draft.clientName}</span>
        {" · "}
        {draft.channel}
        {" · "}
        {draft.provider}
        {draft.fallback ? " (fallback)" : ""}
        {" · "}
        {draft.status.replace("_", " ")}
        {" · "}
        {new Date(draft.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}{" "}
        Europe/London
        {draft.clientId ? (
          <>
            {" · "}
            <Link
              href={`/dashboard/conversations?client=${encodeURIComponent(draft.clientId)}`}
              className="text-accent hover:underline"
            >
              Open thread
            </Link>
          </>
        ) : null}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-white/90">
        <span className="text-muted">Q: </span>
        {compact ? draft.customerQuestion.slice(0, 160) : draft.customerQuestion}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-white">
        <span className="text-muted">Draft: </span>
        {compact ? draft.draftReply.slice(0, 200) : draft.draftReply}
      </p>
      <p className="mt-2 text-[11px] text-muted">
        Id {draft.id}
        {draft.notifiedTelegram
          ? " · notice sent to Kayden's Telegram"
          : draft.telegramError
            ? ` · Telegram notice not sent (${draft.telegramError})`
            : " · Telegram notice not sent"}
        {draft.decidedBy ? ` · decided by ${draft.decidedBy}` : ""}
      </p>
    </div>
  );
}
