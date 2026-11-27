"use client";

import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { attachSolanaDesk } from "./engine";
import "./solana-desk.css";

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="0.6" y="0.6" width="20.8" height="20.8" fill="none" stroke="#6eefe0" strokeWidth="0.9" />
      <path
        d="M11 3.2 L18.2 18.2 H14.8 L13.4 14.8 H8.6 L7.2 18.2 H3.8 Z M11 7.2 L9.3 12.2 H12.7 Z"
        fill="#6eefe0"
      />
    </svg>
  );
}

/**
 * Internal watch desk. Canvas figures and token names are seeded sample data
 * from the approved mock. Nothing here places an order or connects a wallet.
 */
export function SolanaBotDesk({ serverAllowed = false }: { serverAllowed?: boolean }) {
  const { can, loading } = useAuth();
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ReturnType<typeof attachSolanaDesk> | null>(null);
  // Server already rejected other roles. Keep the desk on the first paint,
  // then follow the client module list once /api/auth/me has loaded.
  const allowed = loading ? serverAllowed : can("solana");

  useLayoutEffect(() => {
    if (!allowed || !rootRef.current) return;
    const handle = attachSolanaDesk(rootRef.current);
    handleRef.current = handle;
    return () => {
      handle.destroy();
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [allowed]);

  useLayoutEffect(() => {
    handleRef.current?.sync();
  });

  function jump(event: MouseEvent<HTMLAnchorElement>) {
    const id = event.currentTarget.getAttribute("href")?.replace("#", "");
    const root = rootRef.current;
    if (!id || !root) return;
    const target = root.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!allowed) {
    return <div className="solana-desk" aria-hidden />;
  }

  return (
    <div className="solana-desk" ref={rootRef} data-sample="true">
      <div className="shell">
        <header className="top">
          <div className="top-meta">
            <div className="top-meta-l">
              Signals <span className="plus">+</span> Probability states <span className="plus">+</span> Collapse{" "}
              <span className="plus">+</span> Six agents <span className="plus">+</span>
              <span className="states-hi">1,600 states</span>
            </div>
            <div className="top-meta-r launches-block">
              <span className="lbl">Launches · 24h blocks</span>
              <span className="launches-nums">
                <span>10,048</span>
                <span>7,170</span>
              </span>
            </div>
          </div>
          <div className="top-row">
            <div className="brand">
              <Mark />
              <div className="brand-title">
                KD <span className="slash">{"//"}</span> {t("solanaBot.title")}
              </div>
            </div>
            <div className="pills">
              <span className="pill">{t("solanaBot.internal")}</span>
              <span className="pill warn">{t("solanaBot.watchOnly")}</span>
              <span className="pill dim">{t("solanaBot.sample")}</span>
            </div>
            <label className="theme">
              {t("solanaBot.view")}
              <input id="intensity" type="range" min="0.82" max="1.12" step="0.01" defaultValue="1" />
            </label>
          </div>
          <div className="ticker" aria-label="Sample ticker">
            <span className="muted">PumpSwap · +60% first · −50% first · neither in 60 min</span>
            <span className="tok">$DODZILLA</span> <span className="up">89%</span>
            <span className="muted">1h</span>
            <span className="tok">$RIZHOOD</span> <span className="up">+212.1%</span>
            <span className="tag veto">Veto</span> <span className="tok">$WIGHOOD</span>
            <span className="muted">creator: 39 launches, 0 alive</span>
            <span className="tag curve">Curve</span> <span className="tok">$VOLF</span>
            <span className="muted">reference-sample figures — not live KD data</span>
          </div>
        </header>

        <nav className="jump" aria-label="Section jump">
          <a href="#core" onClick={jump}>{t("solanaBot.jumpCore")}</a>
          <a href="#sim" onClick={jump}>{t("solanaBot.jumpSim")}</a>
          <a href="#orb" onClick={jump}>{t("solanaBot.jumpOrb")}</a>
          <a href="#stack" onClick={jump}>{t("solanaBot.jumpStack")}</a>
          <a href="#river" onClick={jump}>{t("solanaBot.jumpRiver")}</a>
          <a href="#tape" onClick={jump}>{t("solanaBot.jumpTape")}</a>
          <a href="#log" onClick={jump}>{t("solanaBot.jumpLog")}</a>
        </nav>

        <main className="main">
          <section className="row-1">
            <article className="panel" id="core">
              <header className="ph">
                <span className="ph-dot" />
                <h2>Core model</h2>
                <span className="sep">·</span>
                <span className="sub">In training</span>
              </header>
              <div className="body">
                <div className="core-kicker">
                  QORB · LightGBM · <span className="ver">v0.9.4</span>
                  <span className="badge">Research</span>
                </div>
                <div className="subhead">
                  Where a buy lands · X · Y = K
                  <span className="live">Live</span>
                </div>
                <div className="token-line">
                  <span className="tok">$MOGAPE</span>
                  <span className="flag">Selling off</span>
                  <span className="px">$4.2K</span>
                </div>
                <canvas id="buyChart" width={640} height={176} />
                <div className="buy-note">
                  Buy 2.6 SOL @ 8 SOL ln · $3.2K tok · +13.3% · <span className="ok">Result +46.2% · take-profit hit</span>
                </div>
                <div className="labels-block">
                  <div className="labels-h">Labels · measured today</div>
                  <div className="labels-row">
                    <div className="big-num">1,290</div>
                    <div>
                      <canvas id="labelsHist" width={320} height={108} />
                      <div className="hist-cap">Labels / min</div>
                    </div>
                  </div>
                  <div className="tp-line">▲ TP 22% · SL 51% · Time 26%</div>
                  <div className="core-stats">
                    <div className="stat"><div className="k">Events / s</div><div className="v">44</div></div>
                    <div className="stat"><div className="k">Veto</div><div className="v dn">71%</div></div>
                    <div className="stat"><div className="k">Open</div><div className="v cyan">4 / 6</div></div>
                    <div className="inplay">
                      In play <b>4.0%</b> <span className="limit-pill">Limit 15%</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel" id="sim">
              <header className="ph">
                <span className="ph-dot" />
                <h2>Exit simulator</h2>
                <span className="sep">·</span>
                <span className="sub">Monte Carlo</span>
                <span className="sep">·</span>
                <span className="sub">A stream of paths</span>
                <span className="sep">+</span>
                <span className="sub">Three barriers</span>
              </header>
              <div className="body">
                <div className="sim-kicker">
                  <span className="tok">$SOLCAT</span>
                  <span>Entry 0.48 SOL @ mcap $5.8K</span>
                  <span>118 paths in flight · 62 / 0</span>
                </div>
                <div className="sim-stage">
                  <div style={{ position: "relative", minHeight: 0 }}>
                    <canvas id="mcChart" width={900} height={360} />
                    <div className="callout">Time exit · −14.6%</div>
                  </div>
                  <canvas id="mcHist" width={108} height={360} />
                </div>
                <div className="sim-stats">
                  <div className="stat"><div className="k">P(TP)</div><div className="v">0.40</div></div>
                  <div className="stat"><div className="k">P(SL)</div><div className="v dn">0.15</div></div>
                  <div className="stat"><div className="k">P(Time)</div><div className="v">0.45</div></div>
                  <div className="stat"><div className="k">E[mult]</div><div className="v xl">+25.5×</div></div>
                  <div className="stat"><div className="k">Median exit</div><div className="v time">54 min</div></div>
                  <div className="stat"><div className="k">Stop</div><div className="v sl">−30%</div></div>
                </div>
              </div>
            </article>

            <article className="panel" id="ent">
              <header className="ph">
                <span className="ph-dot" />
                <h2>Entanglement map</h2>
                <span className="grow" />
                <span className="meta">13 launches · 140 wallets</span>
              </header>
              <div className="body">
                <div className="ent-top">
                  <span>Case file</span>
                  <span>31 entangled · Scan · 966°</span>
                </div>
                <div className="case">
                  <div>
                    <div className="name">$BLOLORD</div>
                    <div className="meta">11 holders · 2 entangled · Top 10 19.9%</div>
                    <div className="alert">80% of supply in one launch-slot bundle</div>
                    <div className="funder">Funder 4H8C…CAW7 + 21 wallets · 3.0 SOL each</div>
                  </div>
                  <div className="veto-box">
                    <div className="vb">Bundle veto</div>
                    <canvas id="bundleBars" width={140} height={56} />
                  </div>
                </div>
                <canvas id="entMap" width={640} height={420} />
                <div className="legend">
                  <span><i style={{ background: "#6eefe0" }} />Launch</span>
                  <span><i style={{ background: "#dce7ef" }} />Holder</span>
                  <span><i style={{ background: "#5ee0a8" }} />In profit</span>
                  <span><i style={{ background: "#e14b7a" }} />Entangled</span>
                  <span><i style={{ background: "#e6c56a" }} />Creator</span>
                </div>
              </div>
            </article>
          </section>

          <section className="row-2" id="orb">
            <svg id="leaders" viewBox="0 0 100 100" preserveAspectRatio="none" />
            <article className="panel observables">
              <header className="ph">
                <span className="ph-dot" />
                <h2>The orb</h2>
                <span className="sep">·</span>
                <span className="sub">Seven channels</span>
                <span className="sep">→</span>
                <span className="sub">1,600 states</span>
                <span className="sep">→</span>
                <span className="sub">Collapse · six agents</span>
              </header>
              <div className="body">
                <div className="obs-intro">
                  <div>
                    <div className="h">Observables</div>
                    <div className="s">Seven observables · measured by SCT · MAP · JOG</div>
                  </div>
                  <div className="r">1,600 states · each one a launch · amplitude = model score · 289 near collapse</div>
                </div>
                <div className="channels" id="channels" />
              </div>
            </article>

            <div className="burst-cell">
              <canvas id="orbCanvas" width={900} height={640} />
              <div className="orb-caption">
                Measured outcomes · 1,290 labels · observations in · decisions out · to Solana
              </div>
            </div>

            <article className="panel" id="stack">
              <header className="ph">
                <span className="ph-dot" />
                <h2>Decision stack</h2>
                <span className="grow" />
                <span className="live">Live</span>
              </header>
              <div className="body" style={{ paddingTop: 4 }}>
                <div className="stack-h">
                  <div className="sub2">Collapsed · newest on top · watch readouts, not tickets</div>
                  <div className="live-r">
                    +1 every ~2 s<span>sample</span>
                  </div>
                </div>
                <div className="stack" id="decisionStack" role="list" />
              </div>
            </article>
          </section>

          <section className="row-3">
            <article className="panel" id="river">
              <header className="ph">
                <span className="ph-dot" />
                <h2>Slot river</h2>
                <span className="sep">·</span>
                <span className="sub">Solana</span>
                <span className="sep">·</span>
                <span className="sub">400 ms slots</span>
                <span className="sep">·</span>
                <span className="sub">Decisions land here</span>
                <span className="grow" />
                <span className="badge-net">Mainnet</span>
              </header>
              <div className="body">
                <div className="slot-meta">
                  <span>Slot <b>371,911,182</b> · 400 ms · building 63%</span>
                  <span>TPS 0.00 · non-vote 1.74</span>
                </div>
                <div className="slot-stage">
                  <canvas id="slotChart" width={860} height={260} />
                  <canvas id="slotSpark" width={32} height={260} />
                </div>
                <div className="slot-foot">
                  <div className="legend-slot" id="slotLegend" />
                  <canvas id="slotMini" width={520} height={56} />
                  <div className="stk">
                    STK-9<small>BLK-5</small>
                  </div>
                </div>
              </div>
            </article>

            <div className="col-right">
              <article className="panel" id="tape">
                <header className="ph">
                  <span className="ph-dot" />
                  <h2>Trade tape</h2>
                  <span className="sep">·</span>
                  <span className="sub">Position on focus</span>
                  <span className="sep">·</span>
                  <span className="sub">Time &amp; sales</span>
                </header>
                <div className="body">
                  <div className="tape-kicker">
                    <span className="tok">$GIGTOAD</span>
                    <span>2.1 trades/s</span>
                    <span>Net +54.8 SOL</span>
                    <span className="askbuy">
                      <i className="bar" /> Ask buy <span className="up">+35.3%</span>
                    </span>
                  </div>
                  <div className="tape-stage">
                    <div className="tape-flow">
                      <canvas id="tapeChart" width={720} height={200} />
                      <div className="tape-entry">Our entry $23.0K · TP +60% · 24.7% away</div>
                    </div>
                    <div className="ts" id="timesales" />
                  </div>
                </div>
              </article>

              <article className="panel" id="log">
                <header className="ph">
                  <span className="ph-dot" />
                  <h2>Agent log</h2>
                  <span className="sep">·</span>
                  <span className="sub">tail -f</span>
                  <span className="sep">·</span>
                  <span className="sub">Six agents</span>
                  <span className="sep">·</span>
                  <span className="sub">Network</span>
                  <span className="sep">·</span>
                  <span className="sub">Tape</span>
                  <span className="grow" />
                  <span className="log-count" id="logCount">62 lines · 0.6 / 5</span>
                </header>
                <div className="body" style={{ paddingTop: 4 }}>
                  <div className="log-prompt">qorb@mainnet:~/agents$ tail -f agents.log</div>
                  <div id="agentLog" />
                </div>
              </article>
            </div>
          </section>
        </main>

        <footer className="foot">
          <span>
            <b>{t("solanaBot.footerLead")}</b> {t("solanaBot.footerRest")}
          </span>
          <span className="ok">{t("solanaBot.footerNote")}</span>
        </footer>
      </div>
    </div>
  );
}
