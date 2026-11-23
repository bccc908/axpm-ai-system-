/* Ported from the approved AXPM // Solana Bot design mock.
   Seeded sample drawings only — no trading, no wallet, no live feed. */
/**
 * @param {HTMLElement} root
 * @returns {{ destroy: () => void, sync: () => void }}
 */
export function attachSolanaDesk(root) {
  const qs = (sel) => root.querySelector(sel);

  function setLayout() {
    const w = root.clientWidth || root.getBoundingClientRect().width;
    const layout = w > 0 && w < 720 ? "phone" : w > 0 && w < 1100 ? "stack" : w > 0 && w < 1320 ? "tight" : "desk";
    if (root.dataset.layout !== layout) root.dataset.layout = layout;
  }


  /* ---------- seeded RNG ---------- */
  function rng(seed) {
    let s = seed | 0 || 1;
    return function next() {
      s = (s * 1664525 + 1013904223) | 0;
      return (s >>> 0) / 4294967296;
    };
  }
  const rand = rng(0xa511);
  function rint(n) { return (rand() * n) | 0; }

  function fit(canvas) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height, dpr };
  }

  /* ---------- data (sample) ---------- */
  const CHANNELS = [
    { id: "ch1", name: "Followed flow", desc: "Followed buys · 1h", val: "3", color: "#7dffc4", tag: "JOG", sigma: "CH1  z=+3.5σ  ·  0.85", delta: "∇ −3.0%", down: true, spark: [0.3,0.32,0.35,0.4,0.44,0.5,0.58,0.7,0.78,0.85,0.9,0.95] },
    { id: "ch2", name: "Creator risk", desc: "From serial creators", val: "36%", color: "#e8873a", tag: "MAP", sigma: "CH2  z=+0.8σ  ·  0.55", delta: "Δ +11.0%", down: false, spark: [0.4,0.42,0.5,0.55,0.5,0.48,0.52,0.6,0.66,0.7,0.68,0.72] },
    { id: "ch3", name: "Launch rate", desc: "New tokens / min", val: "18.0/m", color: "#5aa8ff", tag: "SCL", sigma: "CH3  z=+0.8σ  ·  0.95", delta: "∇ −3.9%", down: true, spark: [0.55,0.6,0.62,0.7,0.68,0.66,0.64,0.6,0.58,0.55,0.52,0.5] },
    { id: "ch4", name: "Curve inflow", desc: "SOL into curves / min", val: "130 SOL", color: "#e6c56a", tag: "SCT", sigma: "CH4  z=+0.6σ  ·  0.88", delta: "Δ +10.7%", down: false, spark: [0.2,0.22,0.25,0.24,0.28,0.35,0.4,0.48,0.6,0.7,0.78,0.86] },
    { id: "ch5", name: "Graduation rate", desc: "Curves completed · 1h", val: "0.93%", color: "#8b8cff", tag: "SCL", sigma: "CH5  z=+3.6σ  ·  0.55", delta: "Δ +5.5%", down: false, spark: [0.15,0.18,0.2,0.28,0.35,0.42,0.5,0.55,0.62,0.7,0.78,0.84] },
    { id: "ch6", name: "Bundled share", desc: "Bought in the launch slot", val: "51.5%", color: "#ef5d72", tag: "MAP", sigma: "CH6  z=+3.6σ  ·  0.55", delta: "Δ +10.2%", down: false, spark: [0.3,0.32,0.35,0.4,0.45,0.5,0.55,0.6,0.66,0.7,0.78,0.82] },
    { id: "ch7", name: "Market phase", desc: "Above open · 24h", val: "10.2%", color: "#dce7ef", tag: "SCT", sigma: "CH7  z=+0.8σ  ·  0.55", delta: "∇ −4.3%", down: true, spark: [0.4,0.42,0.38,0.36,0.4,0.5,0.55,0.5,0.48,0.6,0.7,0.68] },
  ];

  const DECISIONS = [
    { kind: "SNIP · QNT", token: "$PEB002", add: "22 ADD", why: "EV +2.6% after costs", score: 48, tone: "orange", tp: "TP.20  TH.10  SL.30", micro: [45, 25, 30] },
    { kind: "LABEL · TP", token: "$MOGING", add: "36 ADD", why: "+60% first at 36 min → training", score: 90, tone: "green", tp: "TP.33  TH.27  SL.18", micro: [50, 30, 20] },
    { kind: "BLOCK · GRD", token: "$ZAPAPE", add: "15 ADD", why: "Top 10 own 46% outside the curve", score: 32, tone: "red", tp: "TP.20  TH.29  SL.47", micro: [20, 25, 55] },
    { kind: "SNIP · QNT", token: "$FLUFIN", add: "41 ADD", why: "EV +1.0% after costs", score: 56, tone: "orange", tp: "TP.22  TH.24  SL.36", micro: [40, 25, 35] },
    { kind: "TRADE ENTRY", token: "$KROBOT", add: "08 ADD", why: "Passed QNT + GRD · 0.76 SOL", score: 86, tone: "gold", tp: "TP.32  TH.27  SL.31", micro: [48, 22, 30] },
    { kind: "BLOCK · GRD", token: "$REBNUT", add: "19 ADD", why: "Snipers still hold 35%", score: 38, tone: "magenta", tp: "TP.23  TH.16  SL.51", micro: [22, 20, 58] },
    { kind: "TRADE ENTRY", token: "$SPUMAX", add: "11 ADD", why: "Passed QNT + GRD · 0.36 SOL", score: 70, tone: "gold", tp: "TP.28  TH.24  SL.32", micro: [46, 24, 30] },
    { kind: "BLOCK · GRD", token: "$LUXJET", add: "14 ADD", why: "Snipers still hold 42%", score: 25, tone: "red", tp: "TP.13  TH.21  SL.66", micro: [18, 22, 60] },
    { kind: "LABEL · TIME", token: "$GRUROCK", add: "15N ADD", why: "Neither in 60 min → training", score: 44, tone: "green", tp: "TP.18  TH.21  SL.44", micro: [28, 30, 42] },
    { kind: "SNIP · QNT", token: "$DODZILLA", add: "125 ADD", why: "EV below +3% after costs", score: 53, tone: "orange", tp: "TP.26  TH.16  SL.38", micro: [38, 22, 40] },
    { kind: "TRADE ENTRY", token: "$KRORAT", add: "14S ADD", why: "Passed QNT + GRD · 0.73 SOL", score: 66, tone: "gold", tp: "TP.08  TH.17  SL.43", micro: [42, 20, 38] },
  ];

  const LOG_SEED = [
    { t: "21:09:14.102", a: "NET", msg: "helius 40 MS · triton 65 MS · jito block engine 16 MS", cls: "" },
    { t: "21:09:14.188", a: "QNT", msg: "$SOLCAT · 320 paths · <span class='warn'>P(TP) 0.40</span> · <span class='ok'>E[PnL] +27.0%</span> · median exit 42 MIN", cls: "" },
    { t: "21:09:14.251", a: "GRD", msg: "<span class='bad'>$LUXJET</span> · snipers still hold 42%", cls: "" },
    { t: "21:09:14.307", a: "GRD", msg: "<span class='bad'>$REBNUT</span> · snipers still hold 35%", cls: "" },
    { t: "21:09:14.401", a: "NET", msg: "slot 371,911,187 · leader CD-3 produced no block · 1805 tx rolled to next slot", cls: "" },
    { t: "21:09:14.488", a: "SCT", msg: "curve inflow 130 SOL / min · <span class='ok'>Δ +10.7%</span> · 18.0 launches / min", cls: "" },
    { t: "21:09:14.552", a: "MAP", msg: "$BLOLORD case file · 80% supply in one launch-slot bundle · <span class='bad'>BUNDLE VETO</span>", cls: "" },
    { t: "21:09:14.610", a: "INT", msg: "observables collapse · 289 near collapse · amplitude = model score", cls: "" },
    { t: "21:09:14.677", a: "QNT", msg: "$KROBOT passed QNT + GRD · 0.76 SOL · score 86 · watch only", cls: "" },
    { t: "21:09:14.741", a: "SCT", msg: "labels measured today <span class='hi'>1,290</span> · events/s 44 · veto 71%", cls: "" },
    { t: "21:09:14.802", a: "NET", msg: "slot 371,911,188 · built 400 MS · 63% full · non-vote 1.74", cls: "" },
    { t: "21:09:14.871", a: "INT", msg: "exit sim $SOLCAT · time exit <span class='warn'>−14.6%</span> · barriers TP +50% / SL −30% / T 54 min", cls: "" },
  ];

  const TS_ROWS = [
    { side: "BUY", px: "0.37", sz: "32.4K", tag: "" },
    { side: "BUY", px: "0.39", sz: "32.3K", tag: "" },
    { side: "BUY", px: "0.41", sz: "32.2K", tag: "" },
    { side: "BUY", px: "0.82", sz: "32.1K", tag: "SNIPER" },
    { side: "SELL", px: "0.96", sz: "32.0K", tag: "inc-Fjs" },
    { side: "SELL", px: "0.20", sz: "32.1K", tag: "SNIPER" },
    { side: "BUY", px: "1.42", sz: "32.3K", tag: "YFsw…" },
    { side: "SELL", px: "0.50", sz: "32.0K", tag: "F8L…" },
    { side: "BUY", px: "0.47", sz: "33.1K", tag: "" },
    { side: "BUY", px: "0.44", sz: "31.8K", tag: "" },
    { side: "SELL", px: "0.31", sz: "30.9K", tag: "BUNDLE" },
    { side: "BUY", px: "0.55", sz: "32.6K", tag: "" },
  ];

  /* ---------- mount static lists ---------- */
  function mountChannels() {
    const root = qs("#channels");
    if (!root) return;
    root.innerHTML = CHANNELS.map((c, i) => `
      <div class="ch" id="${c.id}" style="--ch:${c.color}">
        <div class="row1">
          <span class="name">${c.name}</span>
          <span class="val">${c.val}</span>
          <span class="tag">${c.tag}</span>
        </div>
        <div class="desc">${c.desc}</div>
        <canvas class="spark" data-i="${i}" width="240" height="36"></canvas>
        <div class="sigma"><span>${c.sigma}</span><span class="dlt ${c.down ? "dn" : ""}">${c.delta}</span></div>
      </div>`).join("");
    root.querySelectorAll("canvas.spark").forEach((cv) => {
      const c = CHANNELS[+cv.dataset.i];
      const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      c.spark.forEach((v, i) => {
        const x = (i / (c.spark.length - 1)) * w;
        const y = h - 2 - v * (h - 4);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      const last = c.spark[c.spark.length - 1];
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(w - 1, h - 2 - last * (h - 4), 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function mountStack() {
    const root = qs("#decisionStack");
    if (!root) return;
    // Show as many as fit; CSS flex will clip. Include all reference rows.
    root.innerHTML = DECISIONS.map((d) => `
      <div class="drow tone-${d.tone}">
        <div class="bar"></div>
        <div class="mid">
          <div><span class="kind">${d.kind}</span><span class="tok">${d.token}</span><span class="add">${d.add}</span></div>
          <div class="why">${d.why}</div>
          <div class="micro">
            <i style="width:${d.micro[0]}%;background:#5ee0a8"></i>
            <i style="width:${d.micro[1]}%;background:#e6c56a"></i>
            <i style="width:${d.micro[2]}%;background:#ef5d72"></i>
          </div>
        </div>
        <div class="right">
          <div class="score">${d.score}</div>
          <div class="tpsl">${d.tp}</div>
        </div>
      </div>`).join("");
  }

  function mountTape() {
    const root = qs("#timesales");
    if (!root) return;
    const rows = TS_ROWS.map((r) => `<tr>
      <td class="${r.side === "BUY" ? "buy" : "sell"}">${r.side}</td>
      <td class="px">${r.px}</td>
      <td class="sz">${r.sz}</td>
      <td class="tag">${r.tag}</td>
    </tr>`).join("");
    root.innerHTML = `<table>${rows}</table>`;
  }

  let logLines = LOG_SEED.slice();
  function renderLog() {
    const el = qs("#agentLog");
    const count = qs("#logCount");
    if (!el || !count) return;
    const vis = logLines.slice(-12);
    el.innerHTML = vis.map((l) =>
      `<div class="line"><span class="ts">${l.t}</span><span class="agent ${l.a}">${l.a}</span>${l.msg}</div>`
    ).join("");
    count.textContent = `${Math.max(62, logLines.length)} lines · 0.6 / 5`;
  }

  const EXTRA_LOGS = [
    { a: "QNT", msg: "$FLUFIN EV +1.0% after costs · score 56 · <span class='hi'>watch only</span>" },
    { a: "GRD", msg: "$ZAPAPE top 10 own 46% outside the curve · <span class='bad'>block</span>" },
    { a: "SCT", msg: "graduation rate 0.93% · curves completed / 1h · Δ +5.5%" },
    { a: "NET", msg: "slot 371,911,190 · leader built · 1,402 tx landed" },
    { a: "MAP", msg: "followed flow z=+3.5σ · 0.85 · JOG" },
    { a: "INT", msg: "decision stack +1 · $KRORAT trade-entry readout · no order sent" },
    { a: "QNT", msg: "$GIGTOAD tape 2.1 trades/s · net +54.8 SOL · ask buy +35.3%" },
    { a: "NET", msg: "triton 48 MS · helius 36 MS · jito 14 MS" },
  ];
  function tickLog() {
    const src = EXTRA_LOGS[rint(EXTRA_LOGS.length)];
    const now = new Date();
    const t = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, "0")).join(":") +
      "." + String(now.getMilliseconds()).padStart(3, "0");
    logLines.push({ t, a: src.a, msg: src.msg });
    if (logLines.length > 80) logLines = logLines.slice(-60);
    renderLog();
  }

  /* ---------- charts ---------- */
  function drawBuyChart() {
    const cv = qs("#buyChart");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    // grid
    ctx.strokeStyle = "rgba(86,196,196,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = 8 + i * ((h - 20) / 3);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // dashed target
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(86,196,196,0.35)";
    const mid = h * 0.62;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.setLineDash([]);

    const pts = [];
    const N = 80;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const yv = 0.12 + Math.pow(t, 1.35) * 0.78;
      pts.push({ x: t * w, y: h - 8 - yv * (h - 16) });
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#5aa8ff");
    grad.addColorStop(0.45, "#7dffc4");
    grad.addColorStop(1, "#e6c56a");
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // markers
    const marks = [
      { i: 4, c: "#ef5d72" },
      { i: 14, c: "#e6c56a" },
      { i: 22, c: "#5ee0a8" },
    ];
    marks.forEach((m) => {
      const p = pts[m.i];
      ctx.fillStyle = m.c;
      ctx.strokeStyle = m.c;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 5, p.y - 5, 10, 10);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    // end node
    const last = pts[pts.length - 1];
    ctx.fillStyle = "#e6c56a";
    ctx.beginPath(); ctx.arc(last.x - 2, last.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = "9px 'IBM Plex Mono'";
    ctx.fillStyle = "#e6c56a";
    ctx.textAlign = "right";
    ctx.fillText("$4.2K", w - 2, 12);
    ctx.fillStyle = "#5ee0a8";
    ctx.fillText("+80%", w - 2, last.y - 8);
  }

  function drawLabelsHist() {
    const cv = qs("#labelsHist");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const bars = [0.25, 0.3, 0.22, 0.45, 0.4, 0.55, 0.8, 1, 0.92, 0.85, 0.7, 0.75, 0.6];
    const gap = 2;
    const bw = (w - gap * (bars.length - 1)) / bars.length;
    bars.forEach((v, i) => {
      const x = i * (bw + gap);
      const bh = v * (h - 2);
      const g = ctx.createLinearGradient(0, h - bh, 0, h);
      g.addColorStop(0, "#7dffc4");
      g.addColorStop(1, "#1c8f86");
      ctx.fillStyle = g;
      ctx.fillRect(x, h - bh, bw, bh);
    });
  }

  /* Monte Carlo */
  const mcPaths = (() => {
    const paths = [];
    const R = rng(90210);
    const steps = 80;
    for (let p = 0; p < 140; p++) {
      const series = [0];
      let y = 0;
      const drift = R() * 0.012 - 0.006;
      const vol = 0.085 + R() * 0.06;
      let ended = null;
      for (let i = 1; i < steps; i++) {
        y += drift + (R() - 0.47) * vol + (R() - 0.5) * 0.03;
        // barriers: TP +0.50, SL -0.30, time at end
        if (y >= 0.5) { y = 0.5; ended = "tp"; series.push(y); break; }
        if (y <= -0.3) { y = -0.3; ended = "sl"; series.push(y); break; }
        series.push(y);
      }
      if (!ended) ended = "time";
      paths.push({ series, ended, w: 0.4 + R() * 1.2, hue: R() });
    }
    // two hero paths (white)
    const heroA = [];
    const heroB = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      heroA.push(0.02 + Math.sin(t * 6) * 0.08 + t * 0.12 - Math.pow(t, 2) * 0.06);
      heroB.push(-0.02 - Math.sin(t * 5.2) * 0.12 + Math.sin(t * 13) * 0.04 - t * 0.08);
    }
    // force heroB to end near -14.6%
    const adj = -0.146 - heroB[heroB.length - 1];
    for (let i = 0; i < steps; i++) heroB[i] += adj * (i / (steps - 1));
    paths.heroA = heroA;
    paths.heroB = heroB;
    return paths;
  })();

  function drawMC(t) {
    const cv = qs("#mcChart");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const padL = 28, padR = 8, padT = 16, padB = 18;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const yOf = (v) => padT + (0.55 - v) / (0.55 + 0.38) * plotH; // +55% to -38%
    const xOf = (i, n) => padL + (i / (n - 1)) * plotW;

    // grid / time
    ctx.font = "8px 'IBM Plex Mono'";
    ctx.fillStyle = "#4a5866";
    ctx.textAlign = "center";
    [0, 10, 20, 30, 40, 50, 60].forEach((m) => {
      const x = padL + (m / 60) * plotW;
      ctx.strokeStyle = "rgba(86,196,196,0.08)";
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillText(String(m), x, h - 5);
    });

    // barriers
    const tpY = yOf(0.5), slY = yOf(-0.3);
    ctx.strokeStyle = "rgba(94,224,168,0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(padL, tpY); ctx.lineTo(padL + plotW, tpY); ctx.stroke();
    ctx.fillStyle = "#5ee0a8";
    ctx.textAlign = "left";
    ctx.fillText("TAKE PROFIT  +50%", padL + 4, tpY - 4);

    ctx.strokeStyle = "rgba(239,93,114,0.9)";
    ctx.beginPath(); ctx.moveTo(padL, slY); ctx.lineTo(padL + plotW, slY); ctx.stroke();
    ctx.fillStyle = "#ef5d72";
    ctx.fillText("STOP  −30%", padL + 4, slY + 10);

    // paths
    const flicker = 0.75 + Math.sin(t * 0.0018) * 0.12;
    mcPaths.forEach((p) => {
      ctx.beginPath();
      p.series.forEach((v, i) => {
        const x = xOf(i, 80), y = yOf(v);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      let col;
      if (p.ended === "tp") col = `rgba(94,224,168,${0.16 * flicker})`;
      else if (p.ended === "sl") col = `rgba(239,93,114,${0.12 * flicker})`;
      else col = p.hue > 0.5 ? `rgba(230,197,106,${0.18 * flicker})` : `rgba(110,239,224,${0.12 * flicker})`;
      ctx.strokeStyle = col;
      ctx.lineWidth = p.w;
      ctx.stroke();
    });

    function strokeHero(series, color, width) {
      ctx.beginPath();
      series.forEach((v, i) => {
        const x = xOf(i, series.length), y = yOf(v);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    strokeHero(mcPaths.heroA, "rgba(236,240,244,0.95)", 1.6);
    strokeHero(mcPaths.heroB, "rgba(250,250,255,0.95)", 1.8);

    // time-exit marker on heroB end
    const endX = xOf(mcPaths.heroB.length - 1, mcPaths.heroB.length);
    const endY = yOf(mcPaths.heroB[mcPaths.heroB.length - 1]);
    ctx.fillStyle = "#e6c56a";
    ctx.beginPath(); ctx.arc(endX, endY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = "8px 'IBM Plex Mono'";
    ctx.fillText("MED −14.6%", endX - 62, endY + 12);

    // y labels
    ctx.fillStyle = "#4a5866";
    ctx.textAlign = "right";
    ctx.fillText("+50%", padL - 4, tpY + 3);
    ctx.fillText("0", padL - 4, yOf(0) + 3);
    ctx.fillText("−30%", padL - 4, slY + 3);
  }

  function drawMCHist() {
    const cv = qs("#mcHist");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const padT = 16, padB = 18;
    const plotH = h - padT - padB;
    const yOf = (v) => padT + (0.55 - v) / (0.55 + 0.38) * plotH;
    // histogram of terminal values as horizontal bars
    const bins = [];
    const minV = -0.38, maxV = 0.55, nBin = 22;
    for (let i = 0; i < nBin; i++) bins.push(0);
    mcPaths.forEach((p) => {
      const v = p.series[p.series.length - 1];
      let b = Math.floor(((v - minV) / (maxV - minV)) * nBin);
      b = Math.max(0, Math.min(nBin - 1, b));
      bins[b]++;
    });
    const max = Math.max(...bins, 1);
    const bh = plotH / nBin;
    bins.forEach((c, i) => {
      const v0 = minV + (i / nBin) * (maxV - minV);
      const y = yOf(v0 + (maxV - minV) / nBin) ;
      const ww = (c / max) * (w - 6);
      const g = ctx.createLinearGradient(0, 0, ww, 0);
      // color by value
      const mid = (i / nBin);
      if (mid > 0.82) { g.addColorStop(0, "#1c8f86"); g.addColorStop(1, "#5ee0a8"); }
      else if (mid < 0.18) { g.addColorStop(0, "#c43d55"); g.addColorStop(1, "#ef5d72"); }
      else { g.addColorStop(0, "#8a6030"); g.addColorStop(1, "#e6c56a"); }
      ctx.fillStyle = g;
      ctx.fillRect(2, y, Math.max(1, ww), bh - 1);
    });
  }

  function drawBundleBars() {
    const cv = qs("#bundleBars");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const vals = [0.55, 0.7, 0.45, 0.85, 0.4, 0.3, 0.2];
    const cols = ["#5aa8ff", "#5aa8ff", "#5aa8ff", "#5aa8ff", "#ef5d72", "#ef5d72", "#c43d55"];
    const gap = 2, bw = (w - gap * (vals.length - 1)) / vals.length;
    vals.forEach((v, i) => {
      ctx.fillStyle = cols[i];
      const bh = v * h;
      ctx.fillRect(i * (bw + gap), h - bh, bw, bh);
    });
  }

  function drawEnt(t) {
    const cv = qs("#entMap");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.48, cy = h * 0.52;
    const R = Math.min(w, h) * 0.46;
    // globe
    ctx.strokeStyle = "rgba(110,239,224,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // meridians / parallels
    ctx.strokeStyle = "rgba(110,239,224,0.12)";
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 0.35 * Math.abs(k) + R * 0.08, R, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // equatorial pink
    ctx.strokeStyle = "rgba(225,75,122,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.stroke();

    const erng = rng(4242);
    // stars / holders
    for (let i = 0; i < 70; i++) {
      const a = erng() * Math.PI * 2;
      const rad = Math.sqrt(erng()) * R * 0.92;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad * 0.85;
      const kinds = ["#dce7ef", "#6eefe0", "#5ee0a8", "#e14b7a", "#e6c56a"];
      const c = kinds[i % kinds.length];
      const tw = 0.6 + Math.sin(t * 0.003 + i) * 0.25;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.55 + tw * 0.4;
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 5 === 0 ? 1.4 : 0.4), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // $BLOLORD burst slightly left of center
    const bx = cx - R * 0.18, by = cy - R * 0.04;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, 28);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.3, "rgba(110,239,224,0.6)");
    g.addColorStop(1, "rgba(110,239,224,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      ctx.strokeStyle = "rgba(220,230,240,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a) * 16, by + Math.sin(a) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = "#f4f7fa";
    ctx.font = "600 10px 'IBM Plex Sans Condensed'";
    ctx.textAlign = "left";
    ctx.fillText("$BLOLORD", bx + 10, by - 8);

    // right label
    ctx.fillStyle = "#7c8b99";
    ctx.font = "8px 'IBM Plex Mono'";
    ctx.textAlign = "left";
    ctx.fillText("$MOGMAX", cx + R * 0.42, cy - 4);
    ctx.fillText("$100MAX", cx + R * 0.28, cy - R * 0.62);
  }

  /* ORB burst — the hero */
  const ORB = (() => {
    const R = rng(0x0B); // seed
    const spikes = [];
    const N = 340;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (R() - 0.5) * 0.08;
      // slightly more mass on the right / upper-right like the reference
      const bias = 0.7 + 0.4 * Math.max(0, Math.cos(a - 0.4));
      const len = (0.28 + Math.pow(R(), 0.7) * 0.72) * bias;
      const thick = 0.5 + R() * 1.6;
      let color;
      const roll = R();
      if (roll < 0.08) color = "#7dffc4";
      else if (roll < 0.16) color = "#3ad7c8";
      else if (roll < 0.22) color = "#5aa8ff";
      else if (roll < 0.3) color = "#f4f7fa";
      else if (roll < 0.38) color = "#e8873a";
      else if (roll < 0.44) color = "#ef5d72";
      else color = R() > 0.5 ? "#e6c56a" : "#d4a54a";
      const node = R() > 0.35;
      const nodeR = 1.2 + R() * 3.2;
      const inner = R() > 0.7;
      spikes.push({ a, len, thick, color, node, nodeR, inner, phase: R() * Math.PI * 2 });
    }
    return spikes;
  })();

  function drawOrb(t) {
    const cv = qs("#orbCanvas");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.50, cy = h * 0.52;
    const maxR = Math.min(w, h) * 0.48;

    // soft glow core
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.7);
    glow.addColorStop(0, "rgba(230,197,106,0.22)");
    glow.addColorStop(0.25, "rgba(180,140,60,0.08)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const pulse = 1 + Math.sin(t * 0.0015) * 0.018;

    ORB.forEach((s) => {
      const flick = 0.75 + Math.sin(t * 0.002 + s.phase) * 0.25;
      const len = s.len * maxR * pulse;
      const x2 = cx + Math.cos(s.a) * len;
      const y2 = cy + Math.sin(s.a) * len;
      const x1 = cx + Math.cos(s.a) * 6;
      const y1 = cy + Math.sin(s.a) * 6;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 0.55 * flick;
      ctx.lineWidth = s.thick;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

      if (s.inner) {
        const mid = 0.45 + (s.phase % 1) * 0.2;
        const xm = cx + Math.cos(s.a) * len * mid;
        const ym = cy + Math.sin(s.a) * len * mid;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(xm, ym, 1.2, 0, Math.PI * 2); ctx.fill();
      }
      if (s.node) {
        ctx.globalAlpha = 0.9 * flick;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(x2, y2, s.nodeR, 0, Math.PI * 2); ctx.fill();
        // dark ring center like the reference nodes
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#070a12";
        ctx.beginPath(); ctx.arc(x2, y2, Math.max(0.6, s.nodeR * 0.45), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x2, y2, s.nodeR, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    // nucleus
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    core.addColorStop(0, "rgba(255,255,255,0.95)");
    core.addColorStop(0.35, "rgba(230,197,106,0.8)");
    core.addColorStop(1, "rgba(230,197,106,0)");
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
  }

  function drawLeaders() {
    const svg = qs("#leaders");
    const burst = qs("#orbCanvas");
    const row = root.querySelector(".row-2");
    if (!svg || !burst || !row) return;
    const rb = row.getBoundingClientRect();
    const bb = burst.getBoundingClientRect();
    const w = rb.width, h = rb.height;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    const cx = (bb.left - rb.left) + bb.width * 0.50;
    const cy = (bb.top - rb.top) + bb.height * 0.52;
    const maxR = Math.min(bb.width, bb.height);
    const paths = [];
    CHANNELS.forEach((c, i) => {
      const el = root.querySelector("#" + c.id);
      if (!el) return;
      const tag = el.querySelector(".tag") || el;
      const er = tag.getBoundingClientRect();
      const x0 = er.right - rb.left + 4;
      const y0 = er.top + er.height * 0.5 - rb.top;
      const attachA = Math.PI - (0.12 + i * 0.21);
      const attachR = maxR * 0.20;
      const x1 = cx + Math.cos(attachA) * attachR;
      const y1 = cy + Math.sin(attachA) * attachR;
      const c1x = x0 + (x1 - x0) * 0.55;
      const c1y = y0;
      const c2x = x1 - 36;
      const c2y = y1;
      paths.push('<path d="M '+x0+' '+y0+' C '+c1x+' '+c1y+', '+c2x+' '+c2y+', '+x1+' '+y1+'" fill="none" stroke="'+c.color+'" stroke-width="1.5" stroke-opacity="0.88"/>');
      paths.push('<circle cx="'+x1+'" cy="'+y1+'" r="2.5" fill="'+c.color+'"/>');
    });
    const stack = qs("#stack");
    if (stack) {
      const sr = stack.getBoundingClientRect();
      for (let k = 0; k < 3; k++) {
        const a = -0.4 + k * 0.2;
        const x0 = cx + Math.cos(a) * maxR * 0.26;
        const y0 = cy + Math.sin(a) * maxR * 0.26;
        const x1 = sr.left - rb.left + 2;
        const y1 = sr.top - rb.top + 48 + k * 42;
        paths.push('<path d="M '+x0+' '+y0+' C '+(x0+50)+' '+y0+', '+(x1-40)+' '+y1+', '+x1+' '+y1+'" fill="none" stroke="#e8873a" stroke-width="1.6" stroke-opacity="0.8"/>');
      }
    }
    svg.innerHTML = paths.join("");
  }

  const SLOT_COLORS = [
    { k: "Txns", c: "#3a5a9a" },
    { k: "Vote", c: "#2a4060" },
    { k: "Other", c: "#5ee0a8" },
    { k: "Buy", c: "#7dffc4" },
    { k: "Sell", c: "#e8873a" },
    { k: "Create", c: "#e6c56a" },
    { k: "Bundle", c: "#ef5d72" },
  ];

  const SLOT_BARS = (() => {
    const R = rng(777);
    const n = 16;
    const bars = [];
    for (let i = 0; i < n; i++) {
      const base = 0.45 + R() * 0.4;
      const tops = [0.035, 0.028, 0.032, 0.024, 0.022].map((s) => s * (0.7 + R() * 0.6));
      bars.push({ base, tops, label: (0.8 + R() * 2.4).toFixed(2) });
    }
    // a couple of shorter bars
    bars[4].base *= 0.7;
    bars[10].base *= 0.55;
    bars[15].base *= 0.5;
    bars[7].base *= 1.15;
    bars[12].base *= 1.1;
    return bars;
  })();

  function drawSlot() {
    const cv = qs("#slotChart");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const padL = 8, padR = 4, padT = 12, padB = 14;
    const n = SLOT_BARS.length;
    const gap = 6;
    const bw = (w - padL - padR - gap * (n - 1)) / n;
    const maxH = h - padT - padB;
    SLOT_BARS.forEach((b, i) => {
      const x = padL + i * (bw + gap);
      let y = padT + maxH;
      const baseH = b.base * maxH * 0.75;
      // blue txn body with horizontal stripes to mimic the reference
      ctx.fillStyle = "#2a4a86";
      ctx.fillRect(x, y - baseH, bw, baseH);
      ctx.strokeStyle = "rgba(10,20,40,0.35)";
      ctx.lineWidth = 1;
      for (let s = 0; s < 8; s++) {
        const sy = y - (s + 1) * (baseH / 8);
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + bw, sy); ctx.stroke();
      }
      y -= baseH;
      const topCols = ["#5ee0a8", "#7dffc4", "#e8873a", "#e6c56a", "#ef5d72"];
      b.tops.forEach((tv, ti) => {
        const th = tv * maxH;
        ctx.fillStyle = topCols[ti];
        y -= th;
        ctx.fillRect(x, y, bw, th);
      });
      ctx.fillStyle = "#7c8b99";
      ctx.font = "7px 'IBM Plex Mono'";
      ctx.textAlign = "center";
      ctx.fillText(b.label, x + bw / 2, padT + 6);
    });
    // time labels
    ctx.fillStyle = "#4a5866";
    ctx.font = "7px 'IBM Plex Mono'";
    ctx.textAlign = "left";
    ctx.fillText("−16s", padL, h - 3);
    ctx.textAlign = "right";
    ctx.fillText("now", w - padR, h - 3);
  }

  function drawSlotSpark() {
    const cv = qs("#slotSpark");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    // vertical progress like the reference needle
    ctx.fillStyle = "rgba(86,196,196,0.15)";
    ctx.fillRect(w / 2 - 2, 8, 4, h - 16);
    ctx.fillStyle = "#e6c56a";
    ctx.fillRect(w / 2 - 3, 8, 6, (h - 16) * 0.37);
    ctx.fillStyle = "#f4f7fa";
    ctx.fillRect(w / 2 - 5, 8 + (h - 16) * 0.37 - 2, 10, 3);
  }

  function drawSlotMini() {
    const cv = qs("#slotMini");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const R = rng(333);
    // three mini strips
    const bands = 3;
    const bh = (h - 4) / bands;
    for (let b = 0; b < bands; b++) {
      const y = b * bh + 1;
      if (b === 0) {
        // ticks
        for (let i = 0; i < 40; i++) {
          const x = (i / 40) * w;
          const hh = 3 + R() * (bh - 4);
          ctx.fillStyle = R() > 0.2 ? "#2a4a86" : "#5ee0a8";
          ctx.fillRect(x, y + bh - hh, 3, hh);
        }
      } else if (b === 1) {
        ctx.strokeStyle = "#ef5d72";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 60; i++) {
          const x = (i / 59) * w;
          const yy = y + bh / 2 + Math.sin(i * 0.5 + R()) * (bh * 0.3) + (R() - 0.5) * 2;
          if (i) ctx.lineTo(x, yy);
          else ctx.moveTo(x, yy);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#e6c56a";
        ctx.beginPath();
        for (let i = 0; i < 60; i++) {
          const x = (i / 59) * w;
          const yy = y + bh * 0.6 - (i / 59) * bh * 0.3 + Math.sin(i * 0.7) * 2;
          if (i) ctx.lineTo(x, yy);
          else ctx.moveTo(x, yy);
        }
        ctx.stroke();
      }
    }
  }

  function mountSlotLegend() {
    const legend = qs("#slotLegend");
    if (!legend) return;
    legend.innerHTML =
      SLOT_COLORS.map((s) => `<div><i style="background:${s.c}"></i>${s.k}</div>`).join("");
  }

  /* Trade tape — wavy beads */
  const TAPE = (() => {
    const R = rng(2024);
    const beads = [];
    const cols = ["#ef5d72", "#5ee0a8", "#6eefe0", "#e8873a", "#e14b7a", "#7dffc4", "#e6c56a", "#ff7aa2", "#3ad7c8"];
    // clusters along the tape, overlapping like the reference organism
    let t = 0;
    for (let cluster = 0; cluster < 14; cluster++) {
      const n = 3 + (R() * 4) | 0;
      const center = t;
      for (let j = 0; j < n; j++) {
        beads.push({
          t: Math.min(0.99, Math.max(0.01, center + (R() - 0.5) * 0.035)),
          yOff: (R() - 0.5) * 16,
          r: 4 + R() * 9,
          c: cols[(cluster + j) % cols.length],
          ring: R() > 0.35,
          wob: R() * Math.PI * 2,
        });
      }
      t += 0.055 + R() * 0.04;
    }
    return beads;
  })();

  function drawTape(t) {
    const cv = qs("#tapeChart");
    const fitted = fit(cv);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    // baseline
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(230,197,106,0.35)";
    ctx.beginPath();
    const base = h * 0.62;
    ctx.moveTo(0, base); ctx.lineTo(w, base); ctx.stroke();
    ctx.setLineDash([]);

    // wave path
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = base - 8 + Math.sin(x * 0.02 + t * 0.0008) * 10 + Math.sin(x * 0.01) * 6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(110,239,224,0.25)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    TAPE.forEach((b) => {
      const x = b.t * (w - 24) + 12 + Math.sin(t * 0.001 + b.wob) * 2;
      const y = base - 10 + Math.sin(b.t * 7 + t * 0.0008) * 14 + Math.sin(b.t * 3.2) * 7 + (b.yOff || 0);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      if (b.ring) {
        ctx.strokeStyle = b.c;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(x, y, b.r + 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#070a12";
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, b.r * 0.35), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // green callout
    ctx.fillStyle = "rgba(94,224,168,0.15)";
    ctx.strokeStyle = "#5ee0a8";
    ctx.lineWidth = 1;
    ctx.fillRect(w * 0.72, 6, 86, 16);
    ctx.strokeRect(w * 0.72, 6, 86, 16);
    ctx.fillStyle = "#5ee0a8";
    ctx.font = "8px 'IBM Plex Mono'";
    ctx.textAlign = "left";
    ctx.fillText("+35.3%  ASK", w * 0.72 + 6, 17);
  }


  let dead = false;
  let raf = 0;
  /** @type {ResizeObserver | null} */
  let ro = null;
  /** @type {HTMLInputElement | null} */
  const intensity = /** @type {HTMLInputElement | null} */ (qs("#intensity"));
  function onIntensity() {
    const shell = qs(".shell");
    if (shell && intensity) shell.style.setProperty("--intensity", intensity.value);
  }
  intensity?.addEventListener("input", onIntensity);

  let started = 0;
  let lastLog = 0;
  function frame(t) {
    if (dead) return;
    if (!started) started = t;
    drawOrb(t);
    drawMC(t);
    drawTape(t);
    drawEnt(t);
    if (t - lastLog > 2800) {
      lastLog = t;
      tickLog();
    }
    raf = requestAnimationFrame(frame);
  }

  function drawStatic() {
    drawBuyChart();
    drawLabelsHist();
    drawMCHist();
    drawBundleBars();
    drawSlot();
    drawSlotSpark();
    drawSlotMini();
    drawLeaders();
  }

  function boot() {
    if (dead) return;
    setLayout();
    mountChannels();
    mountStack();
    mountTape();
    mountSlotLegend();
    renderLog();
    drawStatic();
    drawOrb(0);
    drawMC(0);
    drawTape(0);
    drawEnt(0);
    raf = requestAnimationFrame(frame);
  }

  function onResize() {
    if (dead) return;
    setLayout();
    mountChannels();
    drawStatic();
  }

  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => onResize());
    ro.observe(root);
  } else {
    window.addEventListener("resize", onResize);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();

  return {
    sync() {
      if (dead) return;
      setLayout();
      mountChannels();
      mountStack();
      mountTape();
      mountSlotLegend();
      renderLog();
      drawStatic();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      intensity?.removeEventListener("input", onIntensity);
    },
  };
}
