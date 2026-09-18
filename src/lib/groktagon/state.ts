import "server-only";

import { listBtcSignals } from "@/lib/btc-signals/store";
import { listEthSignals } from "@/lib/eth-signals/store";
import { listGoldSignals } from "@/lib/gold-signals/store";
import { listHlSignals } from "@/lib/hl-signals/store";
import { fetchGoldOhlc } from "@/lib/gold-signals/chart-data";
import { fetchHlOhlc } from "@/lib/hyperliquid/chart-data";
import { fetchHlAccount } from "@/lib/hyperliquid/account";
import { hlInfo } from "@/lib/hyperliquid/client";
import { fetchHlEthQuote, fetchHlSpotQuote } from "@/lib/hyperliquid/price";
import { getHyperliquidAddress } from "@/lib/hyperliquid/settings";
import { fetchGoldSpotQuote } from "@/lib/gold-signals/price";
import { holdDeadTickets, listGroktagonTickets, syncPendingTickets } from "@/lib/groktagon/tickets";
import { kettAgentAddress, kettArmed, KETT_MAX_BTC, KETT_MAX_ETH } from "@/lib/hyperliquid/trading";
import { gateBtcTrade } from "@/lib/groktagon/trade-gate";
import { getGroktagonAutopilot } from "@/lib/groktagon/autopilot";
import { buildEthQuotePlan } from "@/lib/groktagon/best-quote";
import { fetchEthDayRange, fetchHlBook } from "@/lib/hyperliquid/book";

import type {
  GroktagonAgentId,
  GroktagonLog,
  GroktagonState,
  GroktagonTicket,
} from "@/types/groktagon";

export type { GroktagonAgentId, GroktagonLog, GroktagonState };

type HlFill = {
  coin?: string;
  px?: string;
  sz?: string;
  side?: string;
  time?: number;
  closedPnl?: string;
};

type SignalLite = {
  id: string;
  created_at: string;
  symbol: string;
  bias: string;
  confidence: number;
  thesis?: string;
  expires_at?: string | null;
  entry_zone?: { low: number; high: number } | null;
  stop_loss?: number | null;
  take_profit?: number[];
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sessionLabel() {
  const d = new Date();
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "Asia/Hong_Kong" }).toUpperCase();
  const day = d.toLocaleString("en-US", { day: "2-digit", timeZone: "Asia/Hong_Kong" });
  return `${mon} ${day}`;
}

function uptimeLabel() {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const ms = Math.max(0, Date.now() - start.getTime());
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function asTickets(
  rows: SignalLite[],
  source: GroktagonTicket["source"],
  agent: GroktagonAgentId,
): GroktagonTicket[] {
  return rows
    .filter((s) => s.bias === "long" || s.bias === "short")
    .slice(0, 3)
    .map((s) => ({
      id: `${source}-${s.id}`,
      source,
      symbol: s.symbol,
      bias: s.bias,
      confidence: s.confidence,
      agent,
      text: `${s.symbol} ${s.bias.toUpperCase()} ${s.confidence}% · ${(s.thesis ?? "").slice(0, 80)}`,
      status: "pending",
      created_at: s.created_at,
      decided_at: null,
      expires_at: s.expires_at ?? null,
      entry_low: s.entry_zone?.low ?? null,
      entry_high: s.entry_zone?.high ?? null,
      stop_loss: s.stop_loss ?? null,
      take_profit: s.take_profit?.[0] ?? null,
      block_reason: null,
    }));
}

function annotateTickets(
  tickets: GroktagonTicket[],
  marks: { btc: number | null; eth: number | null },
): GroktagonTicket[] {
  return tickets.map((t) => {
    if (t.status !== "pending") return t;
    const mark = t.source === "eth" ? marks.eth : marks.btc;
    const g = gateBtcTrade(t, mark ?? Number.NaN);
    return { ...t, block_reason: g.ok ? null : g.reason };
  });
}

function liveSetupFrom(
  mark: number | null,
  rows: Array<SignalLite & { source: "btc" | "hl" | "eth" }>,
  emptyReason: string,
): { side: "long" | "short" | null; reason: string; confidence: number | null } {
  if (mark == null) return { side: null, reason: emptyReason.replace("signal", "mark"), confidence: null };
  for (const row of rows) {
    const input = {
      source: row.source,
      bias: row.bias,
      confidence: row.confidence,
      created_at: row.created_at,
      expires_at: row.expires_at ?? null,
      entry_low: row.entry_zone?.low ?? null,
      entry_high: row.entry_zone?.high ?? null,
      stop_loss: row.stop_loss ?? null,
    };
    const g = gateBtcTrade(input, mark);
    if (g.ok && (row.bias === "long" || row.bias === "short")) {
      return {
        side: row.bias,
        reason: `live ${row.source} ${row.bias} ${row.confidence}%`,
        confidence: row.confidence,
      };
    }
  }
  const first = rows[0];
  if (!first) return { side: null, reason: emptyReason, confidence: null };
  const g = gateBtcTrade(
    {
      source: first.source,
      bias: first.bias,
      confidence: first.confidence,
      created_at: first.created_at,
      expires_at: first.expires_at ?? null,
      entry_low: first.entry_zone?.low ?? null,
      entry_high: first.entry_zone?.high ?? null,
      stop_loss: first.stop_loss ?? null,
    },
    mark,
  );
  return { side: null, reason: g.ok ? "no live zone" : g.reason, confidence: first.confidence };
}

export async function loadGroktagonState(): Promise<GroktagonState> {
  const address = await getHyperliquidAddress();
  const [gold, btc, eth, chart, goldChart, goldSignals, btcSignals, ethSignals, hlSignals, account, fills, existingTickets, autopilot, ethBook, ethRange] =
    await Promise.all([
      fetchGoldSpotQuote().catch(() => null),
      fetchHlSpotQuote().catch(() => null),
      fetchHlEthQuote().catch(() => null),
      fetchHlOhlc("5m", "5d").catch(() => null),
      fetchGoldOhlc("5m", "5d").catch(() => null),
      listGoldSignals(8).catch(() => []),
      listBtcSignals(8).catch(() => []),
      listEthSignals(8).catch(() => []),
      listHlSignals(8).catch(() => []),
      address ? fetchHlAccount(address).catch(() => null) : Promise.resolve(null),
      address
        ? hlInfo<HlFill[]>({ type: "userFills", user: address }).catch(() => [])
        : Promise.resolve([]),
      listGroktagonTickets().catch(() => []),
      getGroktagonAutopilot().catch(() => null),
      fetchHlBook("ETH").catch(() => null),
      fetchEthDayRange().catch(() => null),
    ]);

  const ticketsRaw = await syncPendingTickets([
    ...asTickets(ethSignals, "eth", "HOLT"),
    ...asTickets(btcSignals, "btc", "HOLT"),
    ...asTickets(hlSignals, "hl", "TESS"),
  ]).catch(() => existingTickets);
  const ticketsHeld = await holdDeadTickets({ btc: btc?.price ?? null, eth: eth?.price ?? null }).catch(
    () => ticketsRaw,
  );
  const tickets = annotateTickets(ticketsHeld, { btc: btc?.price ?? null, eth: eth?.price ?? null });

  const rawBars = (chart?.bars?.length ? chart.bars : goldChart?.bars) ?? [];
  const bars = rawBars.slice(-80);
  const closes = bars.map((b) => b.close);
  const start = closes[0] ?? btc?.price ?? 100;
  const markEquity = closes.map((c) => Math.round((c / start) * 10_000 * 100) / 100);
  const hlValue = account?.account_value ?? null;
  const equity =
    hlValue != null && markEquity.length
      ? markEquity.map((p) => Math.round((p / 10_000) * hlValue * 100) / 100)
      : [0];
  const balance = hlValue ?? 0;
  const dayPnl =
    account?.positions.reduce((s, p) => s + (p.unrealized_pnl ?? 0), 0) ??
    (equity.length > 1 ? equity[equity.length - 1] - equity[0] : 0);

  const closed = (Array.isArray(fills) ? fills : [])
    .map((f) => num(f.closedPnl))
    .filter((n): n is number => n != null && n !== 0);
  const wins = closed.filter((n) => n > 0).length;
  const win_rate = closed.length >= 3 ? Math.round((wins / closed.length) * 1000) / 10 : null;

  const logs: GroktagonLog[] = [];
  for (const t of tickets.filter((x) => x.status !== "pending").slice(0, 6)) {
    logs.push({
      id: `tix-${t.id}-${t.status}`,
      agent: "KETT",
      kind: t.status === "held" ? "RISK" : "SCAN",
      pnl: null,
      text: `${t.status.toUpperCase()} ${t.symbol} ${t.bias.toUpperCase()} · no order sent`,
      at: t.decided_at ?? t.created_at,
    });
  }
  for (const f of (Array.isArray(fills) ? fills : []).slice(0, 8)) {
    const pnl = num(f.closedPnl);
    logs.push({
      id: `fill-${f.time}-${f.coin}`,
      agent: pnl != null && pnl < 0 ? "RIGO" : "HOLT",
      kind: pnl != null && Math.abs(pnl) > 0 ? "SETTLE" : "FILL",
      pnl,
      text: `${(f.side ?? "buy").toUpperCase()} ${f.coin ?? "BTC"} @ ${f.px ?? "—"} sz ${f.sz ?? "—"}`,
      at: f.time ? new Date(f.time).toISOString() : new Date().toISOString(),
    });
  }
  const mixed = [...ethSignals, ...hlSignals, ...btcSignals, ...goldSignals].slice(0, 10);
  mixed.forEach((s, i) => {
    const agents: GroktagonAgentId[] = ["TESS", "ILSA", "BRAM", "KETT", "HOLT", "RIGO"];
    logs.push({
      id: s.id,
      agent: agents[i % agents.length],
      kind: s.bias === "wait" ? "RISK" : "SCAN",
      pnl: null,
      text: `${s.symbol} ${s.bias.toUpperCase()} ${s.confidence}% · ${(s.thesis ?? "").slice(0, 72)}`,
      at: s.created_at,
    });
  });
  logs.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const goldSig = goldSignals[0];
  const btcSig = btcSignals[0];
  const ethSig = ethSignals[0];
  const hlSig = hlSignals[0];
  const waitish = mixed.some((s) => s.bias === "wait");
  const pending = tickets.filter((t) => t.status === "pending");
  const executable = pending.filter((t) => !t.block_reason && (t.source === "btc" || t.source === "hl" || t.source === "eth"));
  const pos = account?.positions[0];
  const setup = liveSetupFrom(
    btc?.price ?? null,
    [
      ...hlSignals.map((s) => ({ ...s, source: "hl" as const })),
      ...btcSignals.map((s) => ({ ...s, source: "btc" as const })),
    ],
    "no BTC/HL signal on book",
  );
  const ethSetup = liveSetupFrom(
    eth?.price ?? null,
    ethSignals.map((s) => ({ ...s, source: "eth" as const })),
    "no ETH signal on book",
  );
  const plan = buildEthQuotePlan({
    book: ethBook,
    mark: eth?.price ?? null,
    signal: ethSig ?? null,
    range: ethRange,
    fireSide: ethSetup.side,
    fireReason: ethSetup.reason,
  });

  if (plan) {
    logs.unshift({
      id: `holt-quote-${Math.round(plan.mark ?? 0)}`,
      agent: "HOLT",
      kind: plan.fire ? "SCAN" : "RISK",
      pnl: null,
      text: `${plan.headline} · ${plan.best_time}`,
      at: new Date().toISOString(),
    });
  }

  const agents: GroktagonState["agents"] = [
    {
      id: "BRAM",
      role: "PREDICTION",
      status: gold ? (goldSig ? "LIVE" : "SCAN") : "IDLE",
      busy: Boolean(gold),
      line: gold
        ? `XAU ${gold.price.toFixed(2)}${goldSig ? ` · ${goldSig.bias.toUpperCase()} ${goldSig.confidence}%` : " · scanning"}`
        : "no gold tape",
    },
    {
      id: "HOLT",
      role: "SOL SCANNER",
      status: btc || eth ? "LIVE" : "IDLE",
      busy: Boolean(btc || eth),
      line: plan
        ? plan.headline.slice(0, 52)
        : eth
          ? `ETH ${eth.price.toFixed(1)}${ethSig ? ` · ${ethSig.bias.toUpperCase()} ${ethSig.confidence}%` : ""} · BTC ${btc ? Math.round(btc.price) : "—"}`
          : btc
            ? `BTC ${Math.round(btc.price)}${hlSig ? ` · ${hlSig.bias.toUpperCase()} ${hlSig.confidence}%` : btcSig ? ` · ${btcSig.bias.toUpperCase()} ${btcSig.confidence}%` : ""}`
            : "no tape",
    },
    {
      id: "RIGO",
      role: "SETTLEMENT / RISK",
      status: waitish || dayPnl < 0 ? "RISK" : "WATCH",
      busy: true,
      line: plan && !plan.fire
        ? plan.reason.slice(0, 48)
        : waitish
          ? "wait bias on book"
          : dayPnl < 0
            ? `uPnL ${dayPnl.toFixed(2)}`
            : "watching settlement",
    },
    {
      id: "ILSA",
      role: "SENTIMENT / LOLS",
      status: mixed.length ? "LIVE" : "IDLE",
      busy: mixed.length > 0,
      line: mixed[0] ? `${mixed[0].symbol} ${mixed[0].bias.toUpperCase()} ${mixed[0].confidence}%` : "quiet tape",
    },
    {
      id: "KETT",
      role: "EXECUTION",
      status:
        autopilot?.enabled && kettArmed()
          ? "LIVE"
          : kettArmed() && (setup.side || ethSetup.side)
            ? "LIVE"
            : kettArmed()
              ? "WATCH"
              : "IDLE",
      busy: Boolean(autopilot?.enabled || setup.side || ethSetup.side || executable.length),
      line: autopilot?.enabled
        ? `AUTO · ${autopilot.last_result ?? "waiting next tick"}`
        : ethSetup.side
          ? `ETH ${ethSetup.side.toUpperCase()} ${ethSetup.confidence ?? ""}%`
          : setup.side
            ? `BTC ${setup.side.toUpperCase()} ${setup.confidence ?? ""}%`
            : kettArmed()
              ? `armed · ETH ${ethSetup.reason}`
              : "idle · no auto fire",
    },
    {
      id: "TESS",
      role: "RESEARCH",
      status: mixed.length ? "LIVE" : "IDLE",
      busy: mixed.length > 0,
      line: plan
        ? `${plan.best_price} · ${plan.best_time}`.slice(0, 48)
        : (mixed[0]?.thesis ?? "desk research").replace(/\s+/g, " ").slice(0, 42),
    },
  ];

  return {
    balance,
    pnl: dayPnl,
    pnl_note: account ? "HYPERLIQUID uPnL" : "MARK PATH vs OPEN",
    subscription: 0,
    covered_by_pnl: dayPnl >= 0,
    win_rate,
    session: sessionLabel(),
    uptime: uptimeLabel(),
    process: agents.filter((a) => a.busy).length,
    books: Math.max(1, account?.positions.length ?? 1),
    position: pos ? `${pos.coin} ${pos.side.toUpperCase()}` : "FLAT",
    equity: equity.length ? equity : [balance],
    logs: logs.slice(0, 14),
    events: [
      { id: "unrest", title: "UNREST", region: "GLOBAL" },
      { id: "atl", title: "02 · ATLANTIC", region: "FX" },
      { id: "asia", title: "ASIA / PACIFIC", region: "SESSION" },
      { id: "live", title: "WORLDWIDE LIVE", region: "DESK" },
    ],
    quote: {
      btc: btc?.price ?? null,
      gold: gold?.price ?? null,
      eth: eth?.price ?? null,
      btc_chg: btc?.change_pct ?? null,
      eth_chg: eth?.change_pct ?? null,
    },
    plan,
    bars: bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    })),
    agents,
    tickets,
    book: {
      address,
      source: account ? "hyperliquid" : "mark_path",
      account_value: account?.account_value ?? balance,
      withdrawable: account?.withdrawable ?? null,
      margin_used: account?.total_margin_used ?? null,
      positions: (account?.positions ?? []).map((p) => ({
        coin: p.coin,
        side: p.side,
        size: p.size,
        entry_px: p.entry_px,
        unrealized_pnl: p.unrealized_pnl,
      })),
    },
    wallet: address,
    kett: {
      armed: kettArmed(),
      agent: kettAgentAddress(),
      max_btc: KETT_MAX_BTC,
      max_eth: KETT_MAX_ETH,
      setup,
      eth_setup: ethSetup,
      autopilot: {
        enabled: Boolean(autopilot?.enabled),
        prompt: autopilot?.prompt ?? "",
        last_result: autopilot?.last_result ?? null,
        last_run_at: autopilot?.last_run_at ?? null,
        last_fired: Boolean(autopilot?.last_fired),
      },
    },
    as_of: new Date().toISOString(),
  };
}
