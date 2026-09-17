"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Hexagon } from "lucide-react";
import { GroktagonFloor } from "@/components/groktagon/groktagon-floor";
import { cn } from "@/lib/utils";
import type { GroktagonAgentId, GroktagonState, GroktagonTicket } from "@/types/groktagon";

const STEPS = [
  { n: 1, label: "Floor" },
  { n: 2, label: "Status" },
  { n: 3, label: "Tape" },
  { n: 4, label: "Tickets" },
  { n: 5, label: "Wallet" },
] as const;

const AGENTS: Array<{
  id: GroktagonAgentId;
  role: string;
  color: string;
  glow: string;
}> = [
  { id: "BRAM", role: "01 · PREDICTION", color: "#f97316", glow: "rgba(249,115,22,0.55)" },
  { id: "HOLT", role: "02 · SOL SCANNER", color: "#e5e7eb", glow: "rgba(229,231,235,0.4)" },
  { id: "RIGO", role: "03 · SETTLEMENT / RISK", color: "#fb7185", glow: "rgba(251,113,133,0.85)" },
  { id: "ILSA", role: "04 · SENTIMENT / LOLS", color: "#22d3ee", glow: "rgba(34,211,238,0.55)" },
  { id: "KETT", role: "05 · EXECUTION / IDLE", color: "#38bdf8", glow: "rgba(56,189,248,0.5)" },
  { id: "TESS", role: "06 · RESEARCH / IDLE", color: "#93c5fd", glow: "rgba(147,197,253,0.5)" },
];

function money(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function clockStamp(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Hong_Kong",
    });
  } catch {
    return "--:--:--";
  }
}

function EquityChart({ points }: { points: number[] }) {
  const w = 640;
  const h = 168;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 8 - ((p - min) / span) * (h - 20);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const last = points[points.length - 1];
  const lx = w;
  const ly = h - 8 - ((last - min) / span) * (h - 20);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((g) => (
        <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="rgba(34,197,94,0.12)" />
      ))}
      <path d={area} fill="url(#eqFill)" />
      <path d={path} fill="none" stroke="#4ade80" strokeWidth="2.2" />
      <circle cx={lx} cy={ly} r="4" fill="#86efac" />
    </svg>
  );
}

function kindColor(kind: GroktagonState["logs"][number]["kind"], pnl: number | null) {
  if (kind === "RISK" || kind === "SETTLE") return "text-rose-400";
  if (pnl != null && pnl < 0) return "text-rose-400";
  if (kind === "FILL" || (pnl != null && pnl > 0)) return "text-emerald-400";
  return "text-sky-300";
}

export function GroktagonDesk() {
  const [state, setState] = useState<GroktagonState | null>(null);
  const [clock, setClock] = useState("");
  const [focusId, setFocusId] = useState<GroktagonAgentId>("RIGO");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/groktagon/state", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as GroktagonState;
      if (res.ok) setState(data);
    } catch {
      /* ignore */
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Hong_Kong",
        }),
      );
    };
    tick();
    const c = window.setInterval(tick, 1000);
    const boot = async () => {
      if (!alive) return;
      await load();
    };
    void boot();
    const p = window.setInterval(() => {
      if (alive) void load();
    }, 6000);
    return () => {
      alive = false;
      clearInterval(c);
      clearInterval(p);
    };
  }, [load]);

  const selected = useMemo(
    () => state?.agents.find((a) => a.id === focusId) ?? null,
    [state, focusId],
  );
  const pending = (state?.tickets ?? []).filter((t) => t.status === "pending");
  const book = state?.book;
  const kett = state?.kett;
  const step = book?.source === "hyperliquid" ? 5 : pending.length ? 4 : 3;

  async function decide(ticket: GroktagonTicket, action: "approve" | "hold") {
    setBusyId(ticket.id);
    setFlash(null);
    try {
      const res = await fetch("/api/groktagon/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, action }),
      });
      const data = (await res.json()) as {
        state?: GroktagonState;
        error?: string;
        fired?: boolean;
        fire_detail?: string | null;
      };
      if (!res.ok) {
        setFlash(data.error ?? "ticket failed");
        return;
      }
      if (data.state) setState(data.state);
      setFlash(
        action === "hold"
          ? `${ticket.symbol} held · still no fire`
          : data.fired
            ? `${ticket.symbol} · KETT sent ${data.fire_detail}`
            : `${ticket.symbol} recorded · ${data.fire_detail ?? "KETT did not send an order"}`,
      );
    } catch {
      setFlash("ticket failed");
    } finally {
      setBusyId(null);
    }
  }

  async function fire(intent: "close_btc" | "open_btc", side?: "long" | "short") {
    setBusyId(intent);
    setFlash(null);
    try {
      const res = await fetch("/api/groktagon/trade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, side }),
      });
      const data = (await res.json()) as { state?: GroktagonState; error?: string; detail?: string };
      if (data.state) setState(data.state);
      if (!res.ok) {
        setFlash(data.error ?? "trade failed");
        return;
      }
      setFlash(data.detail ?? "order sent");
    } catch {
      setFlash("trade failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="groktagon -mx-4 min-h-[calc(100dvh-7rem)] overflow-x-auto pb-4 pt-2 md:-mx-6 lg:-mx-8">
      <div className="flex min-w-[1100px] flex-col gap-2 px-3 md:px-4 lg:px-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <Hexagon className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-500/80">
              Step {step} / 5 · {step === 5 ? "Wallet live" : step === 4 ? "Human tickets" : "Live desk"}
            </p>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-emerald-100">The Groktagon</h1>
          </div>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {state?.session ?? "—"} · UPTIME {state?.uptime ?? "—"} · PROCESS {state?.process ?? 0} · BOOKS{" "}
          {state?.books ?? 1} · POSITION {state?.position ?? "FLAT"}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
        {STEPS.map((s) => (
          <span
            key={s.n}
            className={cn(
              "rounded-sm border px-2 py-1",
              s.n === step
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                : s.n < step
                  ? "border-white/10 text-zinc-400"
                  : "border-white/5 text-zinc-600",
            )}
          >
            {s.n} {s.label}
            {s.n < step ? " ✓" : s.n === step ? " · now" : ""}
          </span>
        ))}
      </div>

      <p className="font-mono text-[11px] text-zinc-400">
        {booting
          ? "Loading desk…"
          : book?.source === "hyperliquid"
            ? kett?.armed
              ? kett.setup?.side
                ? `KETT armed · live ${kett.setup.side.toUpperCase()} setup. Approve only if the ticket is still in zone. Max 0.00015 BTC with stop and take-profit.`
                : `KETT armed · no live zone (${kett.setup?.reason ?? "stale"}). Open buttons stay locked until a fresh BTC/HL signal is inside the entry.`
              : "Wallet is live. To let KETT send orders, add HYPERLIQUID_AGENT_PRIVATE_KEY to .env.local and restart the app. Never paste the key in chat."
            : pending.length
              ? `Now: ${pending.length} ticket${pending.length === 1 ? "" : "s"} in KETT QUEUE — Approve or Hold. Next: link a read-only Hyperliquid wallet.`
              : "Queue empty. Generate a gold/BTC signal, then come back. Next: link a read-only Hyperliquid wallet."}{" "}
        <Link href="/dashboard/gold-signals?tab=hl" className="text-cyan-400 hover:underline">
          Open Hyperliquid tab
        </Link>
      </p>

      <section className="grid gap-2 md:grid-cols-4">
        <Stat
          label="CURRENT BALANCE"
          sub={book?.source === "hyperliquid" ? "HYPERLIQUID" : "MARK PATH"}
        >
          <span className="text-emerald-300">${money(state?.balance ?? 0)}</span>
        </Stat>
        <Stat label="TOTAL PNL / SESSION" sub={state?.pnl_note ?? ""}>
          <span className={cn((state?.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {(state?.pnl ?? 0) >= 0 ? "+" : ""}${money(state?.pnl ?? 0)}
          </span>
        </Stat>
        <Stat label="SUBSCRIPTION" sub={state?.covered_by_pnl ? "COVERED BY PNL" : "OPEN"}>
          <span className="text-zinc-100">${money(state?.subscription ?? 0)}</span>
        </Stat>
        <Stat label="WIN RATE" sub="CLOSED FILLS">
          <span className="text-emerald-300">
            {state?.win_rate != null ? `${state.win_rate.toFixed(1)}%` : "—"}
          </span>
        </Stat>
      </section>

      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {book?.address ? (
          <>
            WALLET {shortAddr(book.address)}
            {book.source === "hyperliquid" ? " · LIVE BOOK" : " · LINKED, MARK PATH FALLBACK"}
            {book.withdrawable != null ? ` · WITHDRAW $${money(book.withdrawable)}` : ""}
            {book.margin_used != null ? ` · MARGIN $${money(book.margin_used)}` : ""}
            {book.positions[0]
              ? ` · ${book.positions[0].coin} ${book.positions[0].side.toUpperCase()} ${book.positions[0].size}`
              : book.withdrawable
                ? ` · SPOT USDC $${money(book.withdrawable)}`
                : " · FLAT"}
          </>
        ) : (
          <>
            No Hyperliquid wallet linked · mark path only ·{" "}
            <Link href="/dashboard/gold-signals?tab=hl" className="text-cyan-400 hover:underline">
              link read-only wallet
            </Link>
          </>
        )}
      </p>

      <section className="grid gap-2 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="BALANCE HISTORY">
          <div className="relative h-[168px]">
            <EquityChart points={state?.equity ?? []} />
            <p className="pointer-events-none absolute right-3 top-3 font-mono text-xs text-emerald-300">
              ${money(state?.balance ?? 0)}
            </p>
          </div>
        </Panel>
        <Panel
          title="ACTIVITY LOG"
          extra={<span className="text-zinc-600">{state?.logs.length ?? 0} EVENTS</span>}
        >
          <div className="h-[168px] space-y-1 overflow-auto pr-1 font-mono text-[10px] leading-4">
            {(state?.logs ?? []).map((row) => (
              <div key={row.id} className="grid grid-cols-[64px_84px_64px_1fr] gap-2">
                <span className="text-zinc-600">{clockStamp(row.at)}</span>
                <span className={kindColor(row.kind, row.pnl)}>
                  {row.agent} {row.kind}
                </span>
                <span className={row.pnl != null && row.pnl < 0 ? "text-rose-400" : "text-emerald-400"}>
                  {row.pnl == null ? "—" : `${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)}`}
                </span>
                <span className="truncate text-zinc-400">{row.text}</span>
              </div>
            ))}
            {!state?.logs.length ? <p className="text-zinc-600">Waiting for tape…</p> : null}
          </div>
        </Panel>
      </section>

      <Panel title="GLOBAL EVENT FEED">
        <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
          {(state?.events ?? []).map((ev, i) => (
            <div
              key={ev.id}
              className="relative h-16 overflow-hidden rounded-sm border border-white/10 bg-[linear-gradient(135deg,#0b1220,#12304a)]"
            >
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 40%, #22d3ee33, transparent 50%)" }} />
              <p className="relative px-2 pt-2 font-mono text-[10px] font-bold tracking-widest text-cyan-100">{ev.title}</p>
              <p className="relative px-2 font-mono text-[9px] text-cyan-500/80">{ev.region}{i === 3 ? " · LIVE" : ""}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="KETT QUEUE · HUMAN APPROVE"
        extra={
          <span className="text-zinc-600">
            {pending.length} PENDING · {kett?.armed ? `ARMED ${kett.agent ? kett.agent.slice(0, 6) : ""}` : "NO KEY"}
          </span>
        }
      >
        <div className="space-y-1.5">
          {kett?.armed ? (
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-zinc-500">
                {kett.setup?.side
                  ? `LIVE SETUP ${kett.setup.side.toUpperCase()} ${kett.setup.confidence ?? ""}%`
                  : `NO FIRE · ${kett.setup?.reason ?? "waiting for a fresh in-zone signal"}`}
              </p>
              <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => void fire("close_btc")}
                className="rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-300 hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40"
              >
                Close BTC
              </button>
              <button
                type="button"
                disabled={busyId != null || kett.setup?.side !== "short"}
                onClick={() => void fire("open_btc", "short")}
                className="rounded-sm border border-amber-400/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-200 hover:bg-amber-500/10 disabled:opacity-40"
              >
                Open BTC short {kett.max_btc}
              </button>
              <button
                type="button"
                disabled={busyId != null || kett.setup?.side !== "long"}
                onClick={() => void fire("open_btc", "long")}
                className="rounded-sm border border-emerald-400/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
              >
                Open BTC long {kett.max_btc}
              </button>
              </div>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-zinc-600">
              Agent key not in .env.local · KETT cannot send · Approve still only records
            </p>
          )}
          {pending.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[72px_1fr_auto] items-center gap-2 rounded-sm border border-white/10 bg-black/30 px-2 py-1.5 font-mono"
            >
              <span className="text-[10px] text-cyan-300">{t.agent}</span>
              <p className="truncate text-[10px] text-zinc-300">
                {t.symbol} {t.bias.toUpperCase()} {t.confidence}% · {t.block_reason ? `BLOCKED ${t.block_reason}` : t.text}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => void decide(t, "hold")}
                  className="rounded-sm border border-white/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-zinc-400 hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40"
                >
                  Hold
                </button>
                <button
                  type="button"
                  disabled={busyId === t.id || Boolean(t.block_reason)}
                  onClick={() => void decide(t, "approve")}
                  className="rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
          {!pending.length ? (
            <p className="font-mono text-[10px] text-zinc-600">Queue empty · KETT idle · no order will be sent</p>
          ) : null}
          {flash ? <p className="font-mono text-[10px] text-amber-300">{flash}</p> : null}
        </div>
      </Panel>

      <Panel
        title="TRADING FLOOR"
        extra={
          <span className="text-zinc-500">
            PATCH {state?.quote.btc != null ? `BTC ${money(state.quote.btc, 0)}` : "—"} · GOLD{" "}
            {state?.quote.gold != null ? money(state.quote.gold, 2) : "—"}
          </span>
        }
      >
        <div className="groktagon-floor relative overflow-hidden rounded-md">
          <GroktagonFloor
            bars={state?.bars ?? []}
            clock={clock}
            lastPrice={
              state?.quote.btc != null
                ? `BTC ${money(state.quote.btc, 0)}`
                : state?.quote.gold != null
                  ? `GOLD ${money(state.quote.gold, 2)}`
                  : "LIVE"
            }
            agents={state?.agents}
            focusId={focusId}
            onSelect={setFocusId}
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {AGENTS.map((a) => {
            const live = state?.agents.find((x) => x.id === a.id);
            const active = a.id === focusId;
            const on = Boolean(live?.busy);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setFocusId(a.id)}
                className={cn(
                  "groktagon-agent-card rounded-md border px-2 py-2 text-left font-mono",
                  active
                    ? "border-pink-400 bg-pink-500/15 shadow-[0_0_24px_rgba(244,114,182,0.35)]"
                    : "border-white/10 bg-black/30",
                  on ? "is-live" : "is-idle",
                )}
                style={{ "--agent": a.color, "--agent-glow": a.glow } as CSSProperties}
              >
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-500">
                  <i className="groktagon-agent-led" />
                  {a.role}
                </p>
                <p className="text-sm font-semibold text-zinc-100">{a.id}</p>
                <p className="text-[10px]" style={{ color: a.color }}>
                  {live?.status ?? "IDLE"}
                </p>
                <p className="truncate text-[9px] text-zinc-500">{live?.line ?? "waiting desk"}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[10px] text-zinc-500">
          {selected?.id} · {selected?.line ?? selected?.role} · KETT stays idle until you approve a ticket ·{" "}
          <Link href="/dashboard/gold-signals" className="text-cyan-400 hover:underline">
            Open signals desk
          </Link>
        </p>
      </Panel>
      </div>
    </div>
  );
}

function Stat({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-emerald-900/40 bg-black/50 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="font-mono text-2xl font-semibold leading-tight">{children}</div>
      {sub ? <p className="font-mono text-[9px] uppercase text-zinc-600">{sub}</p> : null}
    </div>
  );
}

function Panel({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-emerald-900/30 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">{title}</p>
        {extra}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}
