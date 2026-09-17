"use client";

import type { CSSProperties } from "react";
import { Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroktagonAgentId, GroktagonState } from "@/types/groktagon";

const DESKS: Array<{
  id: GroktagonState["agents"][number]["id"];
  color: string;
  glow: string;
}> = [
  { id: "BRAM", color: "#f97316", glow: "rgba(249,115,22,0.7)" },
  { id: "HOLT", color: "#e5e7eb", glow: "rgba(226,232,240,0.55)" },
  { id: "RIGO", color: "#fb7185", glow: "rgba(251,113,133,0.95)" },
  { id: "ILSA", color: "#22d3ee", glow: "rgba(34,211,238,0.7)" },
  { id: "KETT", color: "#38bdf8", glow: "rgba(56,189,248,0.65)" },
  { id: "TESS", color: "#93c5fd", glow: "rgba(147,197,253,0.65)" },
];

function WallCandles({ bars }: { bars: GroktagonState["bars"] }) {
  const slice = bars.slice(-52);
  if (slice.length < 4) return null;
  const w = 640;
  const h = 210;
  const min = Math.min(...slice.map((b) => b.low));
  const max = Math.max(...slice.map((b) => b.high));
  const span = max - min || 1;
  const bw = w / slice.length;
  const y = (p: number) => 10 + ((max - p) / span) * (h - 22);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      {slice.map((b, i) => {
        const up = b.close >= b.open;
        const x = i * bw + bw * 0.5;
        return (
          <g key={b.time}>
            <line x1={x} x2={x} y1={y(b.high)} y2={y(b.low)} stroke={up ? "#4ade80" : "#fb7185"} strokeWidth="1.2" />
            <rect
              x={x - bw * 0.3}
              y={y(Math.max(b.open, b.close))}
              width={Math.max(2.2, bw * 0.58)}
              height={Math.max(1.4, Math.abs(y(b.open) - y(b.close)))}
              fill={up ? "#22c55e" : "#e11d48"}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function GroktagonFloor({
  bars,
  clock,
  lastPrice,
  agents,
  focusId = "RIGO",
  onSelect,
}: {
  bars: GroktagonState["bars"];
  clock: string;
  lastPrice: string;
  agents?: GroktagonState["agents"];
  focusId?: GroktagonAgentId;
  onSelect?: (id: GroktagonAgentId) => void;
}) {
  return (
    <div className="groktagon-war-room relative overflow-hidden rounded-md">
      <div className="groktagon-war-room-sky" />
      <div className="relative z-[1] grid min-h-[460px] grid-cols-[170px_minmax(0,1fr)_168px] gap-3 px-4 pb-5 pt-4">
        <aside className="flex flex-col items-center justify-between py-2">
          <div className="groktagon-pentagon text-center">
            <Hexagon className="mx-auto h-[72px] w-[72px] text-cyan-200 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]" strokeWidth={1.15} />
            <p className="mt-1 font-mono text-[9px] tracking-[0.32em] text-cyan-100/90">THE GROKTAGON</p>
          </div>
          <div className="groktagon-globe-map" aria-hidden />
          <div className="groktagon-flag-us" aria-hidden />
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="groktagon-wall-monitor relative mb-3 flex-1 overflow-hidden">
            <div className="absolute left-2 top-1 font-mono text-[9px] tracking-widest text-cyan-500/70">
              BTC / GOLD · {lastPrice}
            </div>
            <div className="absolute inset-x-2 bottom-2 top-5">
              <WallCandles bars={bars} />
            </div>
          </div>
          <div className="groktagon-desk-row">
            {DESKS.map((d, i) => {
              const live = agents?.find((a) => a.id === d.id);
              const busy = Boolean(live?.busy);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelect?.(d.id)}
                  className={cn(
                    "groktagon-seat",
                    d.id === focusId && "is-hot",
                    busy ? "is-busy" : "is-idle",
                  )}
                  style={{ "--minion-delay": `${i * 0.35}s` } as CSSProperties}
                >
                  <div
                    className="groktagon-minion"
                    style={{ "--minion": d.color, "--minion-glow": d.glow } as CSSProperties}
                    aria-hidden
                  >
                    <span className="groktagon-minion-figure">
                      <span className="groktagon-minion-head">
                        <i className="groktagon-minion-eye" />
                        <i className="groktagon-minion-eye" />
                      </span>
                      <span className="groktagon-minion-body" />
                      <span className="groktagon-minion-arm is-left">
                        <i className="groktagon-minion-hand" />
                      </span>
                      <span className="groktagon-minion-arm is-right">
                        <i className="groktagon-minion-hand" />
                      </span>
                    </span>
                  </div>
                  <div className="groktagon-desk-body">
                    <div className="groktagon-keys" aria-hidden>
                      {Array.from({ length: 7 }).map((_, k) => (
                        <i key={k} style={{ animationDelay: `${k * 0.08}s` }} />
                      ))}
                    </div>
                    <div className="groktagon-screen" />
                  </div>
                  <span className="groktagon-seat-tag">
                    <b>{d.id}</b>
                    <em className={cn(busy ? "is-on" : "is-off")}>{live?.status ?? "IDLE"}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex flex-col items-end justify-between py-1">
          <div className="groktagon-clock">{clock || "18:30"}</div>
          <div className="groktagon-seals" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="groktagon-orb" aria-hidden />
          <div className="groktagon-flag-star" aria-hidden />
        </aside>
      </div>
    </div>
  );
}
