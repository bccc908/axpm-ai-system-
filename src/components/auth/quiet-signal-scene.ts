/* Quiet Signal — grid, 28-node network, two beams, travelling packets. 8s loop. */
const PERIOD = 8000;
const NODE_COUNT = 28;
const LINK_DIST = 180;
const MAX_LINKS_PER_NODE = 3;

type NodeSeed = {
  x0: number;
  y0: number;
  ax: number;
  ay: number;
  p: number;
  size: number;
};

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNodes(): NodeSeed[] {
  const rand = mulberry32(0x5eed);
  const nodes: NodeSeed[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x0: 0.08 + rand() * 0.84,
      y0: 0.08 + rand() * 0.84,
      ax: 0.012 + rand() * 0.028,
      ay: 0.01 + rand() * 0.024,
      p: rand() * Math.PI * 2,
      size: 1.1 + rand() * 1.1,
    });
  }
  return nodes;
}

export function mountQuietSignal(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return () => {};
  const ctx = context;
  const nodes = buildNodes();

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let running = false;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function reduced() {
    return motionQuery.matches;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w < 700) dpr = Math.min(dpr, 1.5);
    width = w;
    height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nodePos(n: NodeSeed, t: number, frozen: boolean) {
    if (frozen) return { x: n.x0 * width, y: n.y0 * height };
    const a = (t / PERIOD) * Math.PI * 2 + n.p;
    return {
      x: (n.x0 + n.ax * Math.sin(a)) * width,
      y: (n.y0 + n.ay * Math.cos(a)) * height,
    };
  }

  function drawSweep(t: number, frozen: boolean) {
    if (frozen) return;
    const u = (t % PERIOD) / PERIOD;
    const y = u * height;
    const g = ctx.createLinearGradient(0, y - 18, 0, y + 18);
    g.addColorStop(0, "rgba(91, 231, 212, 0)");
    g.addColorStop(0.45, "rgba(91, 231, 212, 0.07)");
    g.addColorStop(0.5, "rgba(142, 245, 230, 0.16)");
    g.addColorStop(0.55, "rgba(91, 231, 212, 0.07)");
    g.addColorStop(1, "rgba(91, 231, 212, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 18, width, 36);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(91, 231, 212, 0.18)";
    ctx.lineWidth = 1;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    const v = ((u + 0.5) % 1) * width;
    const g2 = ctx.createLinearGradient(v - 16, 0, v + 16, 0);
    g2.addColorStop(0, "rgba(142, 245, 230, 0)");
    g2.addColorStop(0.5, "rgba(142, 245, 230, 0.07)");
    g2.addColorStop(1, "rgba(142, 245, 230, 0)");
    ctx.fillStyle = g2;
    ctx.fillRect(v - 16, 0, 32, height);
  }

  function drawNetwork(positions: { x: number; y: number }[], frozen: boolean) {
    const linkDist = Math.min(LINK_DIST, Math.max(120, width * 0.13));
    ctx.lineWidth = 1;
    for (let i = 0; i < positions.length; i++) {
      const links: { j: number; d: number }[] = [];
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const d = Math.hypot(dx, dy);
        if (d < linkDist) links.push({ j, d });
      }
      links.sort((a, b) => a.d - b.d);
      const cap = frozen ? 2 : MAX_LINKS_PER_NODE;
      for (let k = 0; k < Math.min(cap, links.length); k++) {
        const { j, d } = links[k];
        const fade = 1 - d / linkDist;
        ctx.strokeStyle = `rgba(91, 231, 212, ${(0.045 + fade * 0.1).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(positions[i].x, positions[i].y);
        ctx.lineTo(positions[j].x, positions[j].y);
        ctx.stroke();
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const n = nodes[i];
      ctx.beginPath();
      ctx.fillStyle = "rgba(91, 231, 212, 0.28)";
      ctx.arc(p.x, p.y, n.size + 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(142, 245, 230, 0.55)";
      ctx.arc(p.x, p.y, n.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPulses(positions: { x: number; y: number }[], t: number, frozen: boolean) {
    if (frozen || positions.length < 6) return;
    const u = (t % PERIOD) / PERIOD;
    const pairs = [
      [0, 7],
      [4, 15],
      [11, 22],
    ];
    pairs.forEach((pair, idx) => {
      const a = positions[pair[0] % positions.length];
      const b = positions[pair[1] % positions.length];
      const s = (u + idx / 3) % 1;
      const x = a.x + (b.x - a.x) * s;
      const y = a.y + (b.y - a.y) * s;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 7);
      grd.addColorStop(0, "rgba(142, 245, 230, 0.45)");
      grd.addColorStop(0.4, "rgba(91, 231, 212, 0.22)");
      grd.addColorStop(1, "rgba(91, 231, 212, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function frame(now: number) {
    if (width < 1 || height < 1) return;
    const frozen = reduced();
    ctx.clearRect(0, 0, width, height);
    drawSweep(now, frozen);
    const positions = nodes.map((n) => nodePos(n, now, frozen));
    drawNetwork(positions, frozen);
    drawPulses(positions, now, frozen);
  }

  function loop(now: number) {
    if (!running) return;
    frame(now);
    if (reduced()) return;
    raf = requestAnimationFrame(loop);
  }

  function start() {
    running = true;
    cancelAnimationFrame(raf);
    resize();
    if (reduced()) {
      frame(0);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          resize();
          if (reduced()) frame(0);
        })
      : null;
  ro?.observe(canvas);

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }
  document.addEventListener("visibilitychange", onVisibility);

  function onMotionChange() {
    start();
  }
  motionQuery.addEventListener("change", onMotionChange);

  start();

  return () => {
    stop();
    ro?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    motionQuery.removeEventListener("change", onMotionChange);
  };
}
