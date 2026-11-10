/* eslint-disable */
// @ts-nocheck
// Ported from nexus-starter.html (Three.js 0.160). The office behaviour stays here;
// connectLiveData polls /api/ops-floor/summary and falls back to demo mode.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { applyOpsFloorSnapshot } from "@/lib/ops-floor/apply-live";

export function mountNexus(root, initialLabels) {
  let pollTimer = null;
  let rafId = 0;
  let resizeObs = null;
  let followPrefix = (initialLabels && initialLabels.following) || "Following";
  let liveWord = (initialLabels && initialLabels.liveWord) || "live";
  let sessionWord = (initialLabels && initialLabels.sessionWord) || "this session";
  let breakdownTpl = (initialLabels && initialLabels.breakdown) || "{working} working · {busy} busy · {idle} idle · {error} error";
  let statsMode = "demo";
  let sceneReady = false;
  let getLocale = () => "en";
  let getLabels = () => initialLabels || null;
  const liveMemory = { seen: new Set(), primed: false, demoHeld: false };
  let lastSummary = null;
  const cleanups = [];
  root.classList.add("ops-floor");
  root.innerHTML = `<div class="ops-floor-app" id="app">
  <aside id="left">
    <h1 id="brand">AXPM</h1>
    <p class="brand-sub" id="brand-sub">Ops floor</p>
    <div class="sec" id="roster-label">AGENTS ON DUTY</div>
    <div id="agent-list"></div>
  </aside>
  <main id="scene">
    <div id="toolbar">
      <button id="btn-rotate" type="button">⟳ Auto-rotate</button>
      <button id="btn-glow" type="button" class="on">✦ Glow</button>
      <button id="btn-reset" type="button">⌖ Reset view</button>
    </div>
    <div id="focus-chip"><span id="focus-name"></span><button id="focus-x" type="button" title="Stop following">✕</button></div>
    <div id="tip"></div>
    <div id="hint">Drag to rotate · Scroll to zoom · Right-drag to pan · Click an agent to follow</div>
  </main>
  <aside id="right">
    <h2 id="status-heading">SYSTEM STATUS</h2>
    <div class="stat"><div class="label" id="stat-label-agents">AGENTS</div><div class="value cyan" id="stat-agents">15</div><div class="sub" id="stat-breakdown"></div></div>
    <div class="stat"><div class="label" id="stat-label-uptime">UPTIME</div><div class="value green" id="stat-uptime">87h</div><div class="sub"><span class="live"></span><span id="stat-uptime-sub">live</span></div></div>
    <div class="stat"><div class="label" id="stat-label-cost">COST</div><div class="value" id="stat-cost">$1.08</div><div class="sub" id="stat-cost-sub">+$0.0000 this session</div></div>
    <h2 id="activity-heading" style="margin-top:8px">LIVE ACTIVITY</h2>
    <ul id="feed"></ul>
    <div id="ops-health"></div>
    <div id="ops-tips"></div>
    <div id="ops-reminders"></div>
  </aside>
</div>`;
  const qs = (id) => root.querySelector("#" + id);


const NEXUS_BUILD = 'v5-axpm-broker';
// DEMO_MODE simulates status changes, errors and finished tasks so the office feels alive.
// Set to false (or call connectLiveData) once real data drives the hooks below.
const DEMO_MODE = true;
let demoEnabled = DEMO_MODE;

/* ============================================================
 * DATA — replace with real bot data later.
 * Each agent: id, name, role, task, floor (0-4), x/z spawn hint, status.
 * x/z is snapped to the nearest free spot (desk, plant, etc.) on that floor.
 * Status colors map below; add more statuses as needed.
 * ============================================================ */
const STATUS_COLORS = { working: 0x4ff0ff, idle: 0x8a97b3, busy: 0xb07cff, error: 0xff4f6d };
const NAMES = ['Atlas', 'Nova', 'Orion', 'Lyra', 'Vega', 'Echo', 'Juno', 'Kai', 'Pixel', 'Sage', 'Bolt', 'Iris', 'Rex', 'Zed', 'Mira'];
const ROLES = ['Planner', 'Coder', 'Researcher', 'Reviewer', 'Ops', 'Data Analyst', 'Support', 'Designer', 'QA', 'Writer'];
const TASKS = ['Refactor auth module', 'Summarize tickets', 'Index knowledge base', 'Review PR #42', 'Train embeddings',
  'Draft weekly report', 'Triage alerts', 'Sync CRM records', 'Run test suite', 'Optimize SQL query',
  'Design landing hero', 'Answer support chat', 'Scrape pricing data', 'Deploy staging build', 'Tag dataset batch'];
const FLOOR_NAMES = ['Lobby', 'Ops', 'Studio', 'Data Center', 'Research'];
const AGENTS = Array.from({ length: 15 }, (_, i) => ({
  id: `agent-${i + 1}`,
  name: NAMES[i],
  role: ROLES[i % ROLES.length],
  task: TASKS[i],
  floor: i % 5,
  // Spawn hint in the aisle between desk rows / near the right room
  x: [-4, -2.4, -0.8, 2.2, 3.8][Math.floor(i / 5) + (i % 3)] ?? 0,
  z: i % 2 ? -0.35 : 2.4,
  status: i === 11 ? 'error' : ['working', 'idle', 'busy', 'working'][i % 4],
}));

/* STATS — shown in the right panel. Call setStats({...}) to update. */
const STATS = { agents: 15, uptime: '87h', cost: '$1.08', agentsLabel: 'AGENTS', uptimeLabel: 'UPTIME', costLabel: 'COST', uptimeSub: '', costSub: '', breakdown: '', breakdownTpl: '' };

/* ---------- Scene setup ---------- */
const container = qs('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.Fog(0x070a12, 45, 90);

// Orthographic camera at an isometric angle
const frustum = 22;
const aspect = container.clientWidth / container.clientHeight;
const camera = new THREE.OrthographicCamera(-frustum * aspect / 2, frustum * aspect / 2, frustum / 2, -frustum / 2, 0.1, 200);
camera.position.set(20, 20, 20);
camera.lookAt(0, 6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;  // more filmic, professional contrast
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// Floating name labels are HTML elements positioned by CSS2DRenderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(container.clientWidth, container.clientHeight);
Object.assign(labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
container.appendChild(labelRenderer.domElement);

// Post-processing: subtle bloom so neon edges, visors and screens glow (toggle with ✦ Glow)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.55, 0.45, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Basic mouse orbit (+ gentle optional auto-rotate)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 6, 0);
controls.enableDamping = true;
controls.minZoom = 0.5; controls.maxZoom = 4;
controls.autoRotateSpeed = 0.6;

/* ---------- Lighting ---------- */
// Soft ambient fill: cool sky tone from above, dark navy bounce from below
scene.add(new THREE.HemisphereLight(0x7f9cff, 0x0a0f1c, 0.55));
scene.add(new THREE.AmbientLight(0x4a5a8a, 0.25));

// Strong key light that casts soft shadows across the building
const sun = new THREE.DirectionalLight(0xfff1dd, 1.8);
sun.position.set(14, 30, 18);
sun.target.position.set(0, 6, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 20, bottom: -8, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 4;            // softens PCF shadow edges
scene.add(sun, sun.target);

// Cool rim light from behind/left for depth and edge separation
const rim = new THREE.DirectionalLight(0x4ff0ff, 0.5);
rim.position.set(-18, 12, -14);
scene.add(rim);

// Ground plane to catch the building's shadow, plus a faint grid
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0a0e1a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.11; ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(80, 80, 0x1a2848, 0x0f1730);
grid.position.y = -0.1; grid.material.transparent = true; grid.material.opacity = 0.5;
scene.add(grid);

// Shared soft radial glow texture (halos, pulses, particles)
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

/* ---------- Building: 5 floors ---------- */
const FLOORS = 5, FLOOR_H = 3, W = 10, D = 7;
const SLAB_TOP = 0.1;
const slabMat = new THREE.MeshStandardMaterial({ color: 0x141c33 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c2747, transparent: true, opacity: 0.85 });
const deskMat = new THREE.MeshStandardMaterial({ color: 0x2a3658 });

function addBox(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}

/* ---------- Furniture helpers ---------- */
const chairMat   = new THREE.MeshStandardMaterial({ color: 0x3a4670 });
const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1c });
const screenMat  = new THREE.MeshStandardMaterial({ color: 0x4ff0ff, emissive: 0x4ff0ff, emissiveIntensity: 0.6 });
const screenMat2 = new THREE.MeshStandardMaterial({ color: 0xb07cff, emissive: 0xb07cff, emissiveIntensity: 0.6 });
const potMat     = new THREE.MeshStandardMaterial({ color: 0x5a4a3a });
const leafMat    = new THREE.MeshStandardMaterial({ color: 0x2fae6a });
const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x232e4f });
const sofaMat    = new THREE.MeshStandardMaterial({ color: 0x3b2f5e });
const rackLedMat = new THREE.MeshStandardMaterial({ color: 0x5dff9e, emissive: 0x5dff9e, emissiveIntensity: 0.8 });
const paperMat   = new THREE.MeshStandardMaterial({ color: 0xd8dde8 });
const mugMat     = new THREE.MeshStandardMaterial({ color: 0xff8a4f });

// Desk + chair + monitor + small items. rot=0 faces +z, rot=Math.PI faces -z
function addWorkstation(parent, x, z, rot = 0, screen = screenMat) {
  const ws = new THREE.Group(); ws.position.set(x, 0, z); ws.rotation.y = rot; parent.add(ws);
  addBox(1.3, 0.08, 0.65, deskMat, 0, 0.7, 0, ws);                       // desktop
  for (const lx of [-0.58, 0.58]) addBox(0.06, 0.6, 0.55, deskMat, lx, 0.4, 0, ws); // legs
  addBox(0.6, 0.38, 0.04, monitorMat, 0, 1.0, -0.22, ws);                // monitor frame
  addBox(0.54, 0.32, 0.01, screen, 0, 1.0, -0.195, ws);                  // glowing screen
  addBox(0.08, 0.12, 0.08, monitorMat, 0, 0.8, -0.22, ws);               // stand
  addBox(0.45, 0.02, 0.15, monitorMat, 0, 0.75, 0.05, ws);               // keyboard
  addBox(0.2, 0.01, 0.28, paperMat, 0.45, 0.75, 0.05, ws);               // papers
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 10), mugMat);
  mug.position.set(-0.5, 0.79, 0.1); ws.add(mug);
  // Chair: seat, back, post
  addBox(0.45, 0.07, 0.45, chairMat, 0, 0.45, 0.55, ws);
  addBox(0.45, 0.5, 0.07, chairMat, 0, 0.72, 0.78, ws);
  addBox(0.06, 0.38, 0.06, chairMat, 0, 0.22, 0.55, ws);
}
function addPlant(parent, x, z, h = 0.6) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 10), potMat);
  pot.position.set(x, 0.25, z); parent.add(pot);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), leafMat);
  leaves.scale.set(1, h / 0.4, 1); leaves.position.set(x, 0.45 + h / 2, z); parent.add(leaves);
}
function addCabinet(parent, x, z) {
  addBox(0.5, 1.1, 0.45, cabinetMat, x, 0.65, z, parent);
  for (let i = 0; i < 3; i++) addBox(0.2, 0.03, 0.01, paperMat, x, 0.35 + i * 0.33, z + 0.23, parent);
}
function addServerRack(parent, x, z) {
  addBox(0.6, 1.9, 0.6, monitorMat, x, 1.05, z, parent);
  for (let i = 0; i < 6; i++) addBox(0.04, 0.04, 0.01, rackLedMat, x - 0.18 + (i % 2) * 0.1, 0.5 + i * 0.25, z + 0.31, parent);
}
function addMeetingTable(parent, x, z) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 20), deskMat);
  top.position.set(x, 0.7, z); parent.add(top);
  addBox(0.12, 0.6, 0.12, deskMat, x, 0.4, z, parent);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    addBox(0.4, 0.07, 0.4, chairMat, x + Math.cos(a) * 1.15, 0.45, z + Math.sin(a) * 1.15, parent);
  }
}
function addWhiteboard(parent, x, z) { addBox(1.6, 0.9, 0.04, paperMat, x, 1.6, z, parent); }
function addSofa(parent, x, z) {
  addBox(1.6, 0.35, 0.6, sofaMat, x, 0.3, z, parent);
  addBox(1.6, 0.4, 0.15, sofaMat, x, 0.65, z - 0.25, parent);
  addBox(0.7, 0.3, 0.4, deskMat, x, 0.25, z + 0.8, parent); // coffee table
}
function addBench(parent, x, z) {
  addBox(1.15, 0.28, 0.42, sofaMat, x, 0.28, z, parent);
  addBox(1.15, 0.32, 0.08, sofaMat, x, 0.52, z - 0.18, parent);
}

const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xc6a15a, metalness: 0.82, roughness: 0.22, emissive: 0x3a2a08, emissiveIntensity: 0.45 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0xb9c7d8, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.72, emissive: 0x101820, emissiveIntensity: 0.2 });
const mullionMat = new THREE.MeshStandardMaterial({ color: 0x14110d, metalness: 0.65, roughness: 0.35 });
const leatherMat = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 0.72, metalness: 0.05 });

const chartScreens = [];
function seedCandles(upBias) {
  let price = 80;
  const candles = [];
  for (let i = 0; i < 20; i++) {
    const drift = (upBias ? 0.25 : -0.05) + (Math.random() - 0.5) * 2.4;
    const o = price;
    const c = Math.max(6, price + drift);
    candles.push({ o, h: Math.max(o, c) + Math.random() * 1.3, l: Math.min(o, c) - Math.random() * 1.3, c });
    price = c;
  }
  return candles;
}
function paintChart(state) {
  const { ctx, canvas, candles, theme } = state;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, w, h);
  let min = Infinity, max = -Infinity;
  for (const cd of candles) { min = Math.min(min, cd.l); max = Math.max(max, cd.h); }
  const span = Math.max(0.001, max - min);
  const cw = w / candles.length;
  const yOf = (v) => h - ((v - min) / span) * (h - 8) - 4;
  candles.forEach((cd, i) => {
    const x = i * cw + 1;
    const up = cd.c >= cd.o;
    ctx.strokeStyle = ctx.fillStyle = up ? (theme === 'crypto' ? '#5ee7ff' : '#e8c872') : '#ff5d73';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + cw * 0.32, yOf(cd.h));
    ctx.lineTo(x + cw * 0.32, yOf(cd.l));
    ctx.stroke();
    const top = yOf(Math.max(cd.o, cd.c));
    const bot = yOf(Math.min(cd.o, cd.c));
    ctx.fillRect(x, top, Math.max(2, cw - 3), Math.max(1, bot - top));
  });
  state.tex.needsUpdate = true;
}
function makeChartMaterial(theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 90;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const state = { ctx: canvas.getContext('2d'), canvas, tex, theme, candles: seedCandles(theme !== 'down') };
  chartScreens.push(state);
  paintChart(state);
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}
let chartAcc = 0;
function tickCharts(dt) {
  chartAcc += dt;
  if (chartAcc < 0.2) return;
  chartAcc = 0;
  for (const state of chartScreens) {
    const last = state.candles[state.candles.length - 1];
    const o = last.c;
    const c = Math.max(6, o + (Math.random() - 0.48) * 1.7);
    state.candles.push({ o, h: Math.max(o, c) + Math.random() * 0.8, l: Math.min(o, c) - Math.random() * 0.8, c });
    if (state.candles.length > 20) state.candles.shift();
    paintChart(state);
  }
}

const tickerPrices = {
  XAUUSD: { price: 2650.4, change: 0.18 },
  BTCUSD: { price: 68420, change: -0.42 },
  ETHUSD: { price: 3420, change: 0.11 },
};
const tickerCanvas = document.createElement('canvas');
tickerCanvas.width = 2048; tickerCanvas.height = 160;
const tickerCtx = tickerCanvas.getContext('2d');
const tickerTex = new THREE.CanvasTexture(tickerCanvas);
tickerTex.colorSpace = THREE.SRGBColorSpace;
tickerTex.wrapS = THREE.RepeatWrapping;
function formatTickerPx(symbol, row) {
  const digits = symbol === 'BTCUSD' ? 0 : 2;
  const px = row.price.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = row.change > 0 ? '+' : '';
  const ch = Number.isFinite(row.change) ? ` ${sign}${row.change.toFixed(2)}%` : '';
  return `${symbol}  ${px}${ch}`;
}
function paintTicker() {
  const g = tickerCtx;
  const w = tickerCanvas.width, h = tickerCanvas.height;
  g.fillStyle = '#07080c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8c872';
  g.fillRect(0, 0, w, 6);
  g.fillRect(0, h - 6, w, 6);
  g.font = '700 84px monospace';
  g.textBaseline = 'middle';
  g.fillStyle = '#f6e2a8';
  const line = ['XAUUSD', 'BTCUSD', 'ETHUSD'].map((s) => formatTickerPx(s, tickerPrices[s])).join('    ');
  g.fillText(line, 24, h / 2 + 4);
  tickerTex.needsUpdate = true;
}
paintTicker();
function setPrices(list) {
  if (!Array.isArray(list)) return;
  for (const row of list) {
    if (!row || !tickerPrices[row.symbol] || !Number.isFinite(Number(row.price))) continue;
    tickerPrices[row.symbol].price = Number(row.price);
    if (row.change_pct != null && Number.isFinite(Number(row.change_pct))) tickerPrices[row.symbol].change = Number(row.change_pct);
  }
  paintTicker();
}
function makeLogoPlane(text, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#100e09';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#e8c872';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 492, 108);
  g.font = '700 74px monospace';
  g.fillStyle = '#f4d78c';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#e8c872';
  g.shadowBlur = 16;
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  mesh.userData.noCast = true;
  return mesh;
}
function makeCityMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 160;
  const g = canvas.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, '#10162c');
  sky.addColorStop(1, '#1a140c');
  g.fillStyle = sky;
  g.fillRect(0, 0, 320, 160);
  for (let i = 0; i < 16; i++) {
    const bh = 36 + ((i * 37) % 80);
    const bw = 12 + (i % 3) * 4;
    const x = 8 + i * 19;
    g.fillStyle = '#121722';
    g.fillRect(x, 160 - bh, bw, bh);
    g.fillStyle = i % 4 === 0 ? '#e8c872' : '#8fd0ff';
    for (let y = 160 - bh + 6; y < 150; y += 7) {
      for (let xx = x + 2; xx < x + bw - 2; xx += 4) {
        if ((i + y + xx) % 3 !== 0) g.fillRect(xx, y, 2, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}
const cityMat = makeCityMaterial();

function addTradingDesk(parent, x, z, rot, theme) {
  const ws = new THREE.Group(); ws.position.set(x, 0, z); ws.rotation.y = rot; parent.add(ws);
  addBox(1.46, 0.08, 0.7, deskMat, 0, 0.7, 0, ws);
  for (const lx of [-0.66, 0.66]) addBox(0.05, 0.6, 0.58, deskMat, lx, 0.4, 0, ws);
  addBox(1.46, 0.02, 0.7, goldTrimMat, 0, 0.75, 0, ws);
  const chart = makeChartMaterial(theme);
  for (const mx of [-0.34, 0.32]) {
    addBox(0.58, 0.36, 0.04, monitorMat, mx, 1.08, -0.24, ws);
    addBox(0.5, 0.28, 0.012, chart, mx, 1.08, -0.214, ws);
  }
  addBox(0.55, 0.02, 0.16, monitorMat, 0, 0.76, 0.08, ws);
  addBox(0.45, 0.07, 0.45, chairMat, 0, 0.45, 0.58, ws);
  addBox(0.45, 0.48, 0.07, chairMat, 0, 0.72, 0.8, ws);
  addBox(0.06, 0.38, 0.06, chairMat, 0, 0.22, 0.58, ws);
}
function addReceptionDesk(parent, x, z) {
  addBox(2.3, 0.86, 0.55, leatherMat, x, 0.48, z, parent);
  addBox(2.35, 0.06, 0.62, goldTrimMat, x, 0.94, z, parent);
  addBox(0.34, 0.7, 0.34, chairMat, x + 0.7, 0.4, z + 0.7, parent);
}
function addExecutiveDesk(parent, x, z) {
  addBox(2.5, 0.1, 1.15, leatherMat, x, 0.72, z, parent);
  addBox(2.2, 0.035, 0.85, goldTrimMat, x, 0.79, z, parent);
  addBox(0.62, 0.78, 0.62, leatherMat, x - 0.55, 0.42, z + 0.95, parent);
  addBox(0.7, 0.45, 0.08, leatherMat, x - 0.55, 0.95, z + 1.2, parent);
}

// Floors keep the same aisles. Furniture is themed for an AXPM broker office.
// 0 lobby, 1 gold desk, 2 crypto, 3 CRM / IB, 4 CEO office + finance.
function furnishFloor(g, f) {
  for (let i = 0; i < 3; i++) {
    const x = -4 + i * 1.6;
    if (f === 1 || f === 2) {
      addTradingDesk(g, x, -1.6, 0, f === 1 ? 'gold' : 'crypto');
      addTradingDesk(g, x, 0.9, Math.PI, f === 1 ? 'gold' : 'crypto');
    } else if (f === 0) {
      addBench(g, x, -1.45);
      if (i === 1) addWorkstation(g, x, 1.0, Math.PI, screenMat);
      else addPlant(g, x, 1.15, 0.55);
    } else {
      addWorkstation(g, x, -1.6, 0, (i + f) % 2 ? screenMat : screenMat2);
      addWorkstation(g, x, 0.9, Math.PI, (i + f) % 2 ? screenMat2 : screenMat);
    }
  }
  if (f !== 0) { addCabinet(g, -4.6, -3.0); addCabinet(g, -4.0, -3.0); }
  addPlant(g, -4.5, 2.9);
  addPlant(g, 0.5, -3.0, 0.9);

  if (f === 0) {
    addReceptionDesk(g, 3.15, -1.35);
    addSofa(g, 3.2, 1.55);
    addPlant(g, 4.45, -2.9, 1.0);
    const logo = makeLogoPlane('AXPM', 2.8, 0.78);
    logo.position.set(3.15, 1.35, -0.95);
    g.add(logo);
    const wallLogo = makeLogoPlane('AXPM', 2.2, 0.6);
    wallLogo.position.set(-1.35, 1.72, -3.28);
    g.add(wallLogo);
  } else if (f === 1) {
    addTradingDesk(g, 3.25, -1.45, 0, 'gold');
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.95), new THREE.MeshBasicMaterial({ map: tickerTex, toneMapped: false }));
    board.position.set(-1.45, 1.7, -3.28);
    board.userData.noCast = true;
    g.add(board);
    addPlant(g, 4.45, 2.7);
  } else if (f === 2) {
    addTradingDesk(g, 2.55, -1.45, 0, 'crypto');
    addTradingDesk(g, 4.15, -1.45, 0, 'crypto');
    addMeetingTable(g, 3.25, 1.25);
    addPlant(g, 4.45, 2.7, 0.7);
  } else if (f === 3) {
    addMeetingTable(g, 3.15, -1.2);
    addSofa(g, 3.3, 1.55);
    addWhiteboard(g, 3.1, -3.28);
    addPlant(g, 4.45, 2.75);
  } else {
    addExecutiveDesk(g, 3.2, -1.45);
    addMeetingTable(g, 3.25, 1.4);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.05), cityMat);
    city.position.set(-1.2, 1.7, -3.28);
    city.userData.noCast = true;
    g.add(city);
    addPlant(g, 4.5, -2.9, 0.8);
  }
}

const floorGroups = [], floorEdgeMats = [], floorNeonMats = [];
const NEON = new THREE.Color(0xe2c16b);
for (let f = 0; f < FLOORS; f++) {
  const g = new THREE.Group();
  g.position.y = f * FLOOR_H;
  scene.add(g); floorGroups.push(g);

  // Floor slab with neon edge outline (per-floor material so the glow can ripple up the tower)
  const slab = addBox(W, 0.2, D, slabMat, 0, 0, 0, g); slab.userData.noCast = true;
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xe2c16b, transparent: true, opacity: 0.55 });
  slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), edgeMat));
  floorEdgeMats.push(edgeMat);
  // Neon glow strips along the two open edges (front + right); HDR color so bloom picks them up
  const neonMat = new THREE.MeshBasicMaterial({ color: NEON.clone().multiplyScalar(2.2), toneMapped: true });
  floorNeonMats.push(neonMat);
  addBox(W, 0.035, 0.035, neonMat, 0, SLAB_TOP, D / 2, g).userData.noCast = true;
  addBox(0.035, 0.035, D, neonMat, W / 2, SLAB_TOP, 0, g).userData.noCast = true;

  // Glass curtain on the back and left, with a faint front sheet so the floor stays readable.
  addBox(W, FLOOR_H - 0.25, 0.06, glassMat, 0, FLOOR_H / 2, -D / 2, g).userData.noCast = true;
  addBox(0.06, FLOOR_H - 0.25, D, glassMat, -W / 2, FLOOR_H / 2, 0, g).userData.noCast = true;
  addBox(W * 0.72, FLOOR_H - 0.4, 0.02, glassMat, -0.6, FLOOR_H / 2, D / 2 - 0.04, g).userData.noCast = true;
  addBox(W, 0.045, 0.08, goldTrimMat, 0, FLOOR_H - 0.16, -D / 2, g).userData.noCast = true;
  addBox(0.08, 0.045, D, goldTrimMat, -W / 2, FLOOR_H - 0.16, 0, g).userData.noCast = true;
  for (let i = 0; i <= 7; i++) {
    addBox(0.035, FLOOR_H - 0.35, 0.02, mullionMat, -W / 2 + 0.3 + i * (W / 7.4), FLOOR_H / 2, -D / 2 + 0.05, g).userData.noCast = true;
  }
  // Low interior partition to suggest rooms
  addBox(0.1, 1, D * 0.6, wallMat, 1, 0.6, -D * 0.2, g).userData.noCast = true;

  // Furniture: see furnishFloor() above
  furnishFloor(g, f);

  // Interior lights: warm ceiling light over the desks, cool accent over the side room
  const warm = new THREE.PointLight(0xffd9a8, 9, 8, 2);
  warm.position.set(-2.4, FLOOR_H - 0.4, -0.3); g.add(warm);
  const cool = new THREE.PointLight(f === 3 ? 0x5dff9e : 0x9a7cff, 4, 6, 2);
  cool.position.set(3, FLOOR_H - 0.5, -1); g.add(cool);
  // Small visible ceiling fixtures
  addBox(1.4, 0.04, 0.2, new THREE.MeshBasicMaterial({ color: 0xffe6c4 }), -2.4, FLOOR_H - 0.25, -0.3, g);
}

// Shadows: every solid mesh casts and receives (edge lines and lights are skipped automatically)
// Slabs and walls don't cast, so every floor (not just the top one) gets sunlight.
scene.traverse(o => { if (o.isMesh && o !== ground) { o.castShadow = !o.userData.noCast; o.receiveShadow = true; } });

// Roof wordmark, visible from the isometric corner, plus an LED price band.
const roofSign = makeLogoPlane('AXPM', 7.4, 2.05);
roofSign.position.set(0, FLOORS * FLOOR_H + 0.95, 0.15);
roofSign.rotation.x = -Math.PI / 2;
scene.add(roofSign);
addBox(4.4, 0.12, 0.18, goldTrimMat, 0.15, FLOORS * FLOOR_H + 0.55, 0.85, scene).userData.noCast = true;
const tickerMat = new THREE.MeshBasicMaterial({ map: tickerTex, toneMapped: false });
const frontTicker = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.72, 0.08), tickerMat);
frontTicker.position.set(0, FLOOR_H * 2 + 0.55, D / 2 + 0.2);
frontTicker.userData.noCast = true;
scene.add(frontTicker);
const sideTicker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, D + 0.4), tickerMat);
sideTicker.position.set(W / 2 + 0.2, FLOOR_H * 2 + 0.55, 0);
sideTicker.userData.noCast = true;
scene.add(sideTicker);

/* ---------- Elevator: glowing beam on the right side of the building ---------- */
const ELEV = { x: 5.75, z: 0.2 };
const TOWER_H = FLOORS * FLOOR_H;
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, TOWER_H + 0.6, 28, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xe2c16b, opacity: 0.08, side: THREE.DoubleSide, ...additive }));
beam.position.set(ELEV.x, TOWER_H / 2 - 0.3, ELEV.z); scene.add(beam);
const padMat = new THREE.MeshStandardMaterial({ color: 0x141c33, emissive: 0x0b2a3a, emissiveIntensity: 0.6 });
const ringMat = new THREE.MeshBasicMaterial({ color: NEON.clone().multiplyScalar(2) });
const ringGeo = new THREE.TorusGeometry(0.52, 0.022, 6, 36);
for (let f = 0; f < FLOORS; f++) {
  const pad = addBox(1.35, 0.12, 1.1, padMat, 5.6, f * FLOOR_H + 0.04, ELEV.z, scene);  // landing pad
  pad.receiveShadow = true;
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2;
  ring.position.set(ELEV.x, f * FLOOR_H + 0.12, ELEV.z); scene.add(ring);
}
// Rings that drift up the shaft
const driftRings = Array.from({ length: 6 }, (_, i) => {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4ff0ff, opacity: 0.5, ...additive }));
  m.rotation.x = Math.PI / 2; m.position.set(ELEV.x, (i / 6) * TOWER_H, ELEV.z); scene.add(m); return m;
});
// Moving platform that carries the rider
const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 28),
  new THREE.MeshStandardMaterial({ color: 0x1c2747, emissive: 0xe2c16b, emissiveIntensity: 0.45 }));
platform.position.set(ELEV.x, SLAB_TOP + 0.03, ELEV.z); scene.add(platform);
const elevator = { busy: false, rider: null, last: -10 };

/* ---------- Data-flow light lines between floors ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flowCurves = [];
for (let f = 0; f < FLOORS - 1; f++) {
  const y0 = f * FLOOR_H + SLAB_TOP, y1 = (f + 1) * FLOOR_H + SLAB_TOP;
  const [xa, xb] = f % 2 ? [-3.9, -4.7] : [-4.7, -3.9];
  flowCurves.push(new THREE.CubicBezierCurve3(V(xa, y0, D / 2), V(xa, y0 + 1, D / 2 + 1), V(xb, y1 - 1, D / 2 + 1), V(xb, y1, D / 2)));
  const [za, zb] = f % 2 ? [2.2, 3.0] : [3.0, 2.2];
  flowCurves.push(new THREE.CubicBezierCurve3(V(W / 2, y0, za), V(W / 2 + 1, y0 + 1, za), V(W / 2 + 1, y1 - 1, zb), V(W / 2, y1, zb)));
}
flowCurves.push(new THREE.LineCurve3(V(W / 2, SLAB_TOP, D / 2), V(W / 2, (FLOORS - 1) * FLOOR_H + SLAB_TOP, D / 2)));
flowCurves.push(new THREE.LineCurve3(V(-W / 2, SLAB_TOP, D / 2), V(-W / 2, (FLOORS - 1) * FLOOR_H + SLAB_TOP, D / 2)));
const flowLineMat = new THREE.LineBasicMaterial({ color: 0x4ff0ff, transparent: true, opacity: 0.22 });
const pulseMats = [0x4ff0ff, 0xb07cff, 0x5dff9e].map(c =>
  new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(c).multiplyScalar(2.2), ...additive }));
const pulses = [];
flowCurves.forEach((curve, ci) => {
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), flowLineMat));
  const len = curve.getLength();
  for (let k = 0; k < 2; k++) {
    const s = new THREE.Sprite(pulseMats[(ci + k) % 3]); s.scale.setScalar(0.42); scene.add(s);
    pulses.push({ s, curve, t: Math.random(), speed: (1.2 + Math.random() * 1.2) / len, dir: Math.random() < 0.5 ? 1 : -1 });
  }
});

/* ---------- Work particles: tiny glowing bits rising from busy desks (one shared Points pool) ---------- */
const PCOUNT = 220;
const pPos = new Float32Array(PCOUNT * 3), pCol = new Float32Array(PCOUNT * 3);
const pVel = new Float32Array(PCOUNT * 3), pLife = new Float32Array(PCOUNT), pBase = new Float32Array(PCOUNT * 3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: glowTex, ...additive }));
particles.frustumCulled = false; scene.add(particles);
let pNext = 0;
const tmpC = new THREE.Color();
function emitParticle(x, y, z, hex) {
  const i = pNext; pNext = (pNext + 1) % PCOUNT;
  pPos.set([x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.2], i * 3);
  pVel.set([(Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.35, (Math.random() - 0.5) * 0.15], i * 3);
  tmpC.setHex(hex).multiplyScalar(1.8); pBase.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  pLife[i] = 1;
}
function updateParticles(dt) {
  for (let i = 0; i < PCOUNT; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt * 0.8;
    const l = Math.max(pLife[i], 0);
    for (let k = 0; k < 3; k++) { pPos[i * 3 + k] += pVel[i * 3 + k] * dt; pCol[i * 3 + k] = pBase[i * 3 + k] * l; }
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

/* ============================================================
 * NAVIGATION — per-floor waypoint graph along the aisles.
 * Agents only walk along edges, so they route around desks/furniture.
 * Spots are destinations (desk, whiteboard, plant, sofa, racks...).
 * ============================================================ */
function buildNav(f) {
  const nodes = [], adj = [], spots = [];
  const add = (x, z) => { nodes.push({ x, z }); adj.push([]); return nodes.length - 1; };
  const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  const chain = ids => ids.slice(1).forEach((id, i) => link(ids[i], id));
  const spot = (node, kind, label, face) => spots.push({ node, kind, label, face, taken: null });
  const faceTo = (from, x, z) => Math.atan2(x - nodes[from].x, z - nodes[from].z);
  // Middle aisle (between the two desk rows) and front walkway
  const AX = [-4.42, -3.58, -3.2, -2.82, -1.98, -1.6, -1.22, -0.38, 0.35];
  const aisle = AX.map(x => add(x, -0.35)); chain(aisle);
  const front = [-4.0, -3.2, -1.6, 0.35].map(x => add(x, 2.1)); chain(front);
  link(aisle[2], front[1]); link(aisle[5], front[2]); link(aisle[8], front[3]);   // gaps between desks
  // Desk spots: stand beside the chair, facing the monitor
  [-4, -2.4, -0.8].forEach(x => {
    const a = add(x + 0.42, -0.95); link(aisle[AX.indexOf(+(x + 0.42).toFixed(2))], a); spot(a, 'desk', 'desk', Math.PI);
    const b = add(x - 0.42, 0.25);  link(aisle[AX.indexOf(+(x - 0.42).toFixed(2))], b); spot(b, 'desk', 'desk', 0);
  });
  // Back corridor behind the desks: plant + whiteboard
  const back = add(0.35, -2.5); link(aisle[8], back); spot(back, 'plant', 'plant', faceTo(back, 0.5, -3.0));
  const wb = add(-1.5, -2.6); link(back, wb); spot(wb, 'whiteboard', 'whiteboard', Math.PI);
  spot(front[0], 'plant', 'plant', faceTo(front[0], -4.5, 2.9));
  // Into the right-hand room and the elevator landing
  const door = add(1.7, 1.3); link(front[3], door);
  const room = add(3.2, 0.6); link(door, room);
  const approach = add(4.6, 0.2); link(room, approach);
  const cab = add(ELEV.x, ELEV.z); link(approach, cab);
  // Floor-specific destinations
  if (f === 0) {
    const s = add(3.9, -1.0); link(room, s); spot(s, 'sofa', 'lounge', faceTo(s, 3, -2.2));
    const r = add(2.3, 2.0); link(door, r); spot(r, 'plant', 'reception', faceTo(r, 1.6, 2.8));
  } else if (f === 3) {
    for (const x of [2.3, 3.9]) { const s = add(x, -2.0); link(room, s); spot(s, 'meeting', 'client lounge', Math.PI); }
  } else if (f % 2) {
    for (const x of [2.2, 3.8]) { const s = add(x, 0.3); link(room, s); spot(s, 'meeting', 'meeting', faceTo(s, 3, -1.2)); }
  } else {
    for (const x of [2.92, 4.42]) { const s = add(x, -0.95); link(room, s); spot(s, 'desk', 'desk', Math.PI); }
  }
  if (f === 1 || f === 3) { const s = add(4.1, 2.2); link(room, s); spot(s, 'plant', 'window plant', faceTo(s, 4.4, 2.8)); }
  return { nodes, adj, spots, cab, approach };
}
const NAV = Array.from({ length: FLOORS }, (_, f) => buildNav(f));

// Dijkstra over a tiny graph; returns node ids from start (exclusive) to goal (inclusive)
function findPath(nav, start, goal) {
  if (start === goal) return [];
  const n = nav.nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[start] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity || u === goal) break;
    done[u] = true;
    for (const v of nav.adj[u]) {
      const d = dist[u] + Math.hypot(nav.nodes[u].x - nav.nodes[v].x, nav.nodes[u].z - nav.nodes[v].z);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  const path = []; for (let v = goal; v !== start && v >= 0; v = prev[v]) path.unshift(v);
  return path;
}

/* ---------- Agents: cute little robots (shared geometries/materials) ---------- */
const gBody = new THREE.CapsuleGeometry(0.17, 0.16, 6, 14);
const gHead = new THREE.SphereGeometry(0.2, 20, 16);
const gFace = new THREE.SphereGeometry(0.15, 16, 12);
const gVisor = new THREE.CapsuleGeometry(0.042, 0.14, 4, 10); gVisor.rotateZ(Math.PI / 2);
const gAntenna = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6);
const gTip = new THREE.SphereGeometry(0.04, 10, 8);
const gArm = new THREE.CapsuleGeometry(0.045, 0.12, 4, 8); gArm.translate(0, -0.08, 0);
const gFoot = new THREE.SphereGeometry(0.075, 10, 8);
const gHalo = new THREE.PlaneGeometry(1.2, 1.2);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xe6ecf7, roughness: 0.35, metalness: 0.1 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 0.2, metalness: 0.4 });
const footMat = new THREE.MeshStandardMaterial({ color: 0x2a3658, roughness: 0.6 });
// One glow + halo material per status: changing status just swaps materials
const statusMats = {};
for (const [k, c] of Object.entries(STATUS_COLORS)) {
  statusMats[k] = {
    glow: new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5, roughness: 0.3 }),
    halo: new THREE.MeshBasicMaterial({ map: glowTex, color: c, opacity: 0.6, ...additive }),
  };
}
const hex = c => '#' + c.toString(16).padStart(6, '0');

const agentMeshes = new Map(); // id -> agent root group (kept for compatibility with older hooks)
const agentById = new Map();
const hitTargets = [];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function buildAgent(a) {
  const root = new THREE.Group();
  const halo = new THREE.Mesh(gHalo, null); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.015; halo.renderOrder = 1; root.add(halo);
  const bob = new THREE.Group(); root.add(bob);
  const body = new THREE.Mesh(gBody, shellMat); body.position.y = 0.33; bob.add(body);
  const belly = new THREE.Mesh(gTip, null); belly.position.set(0, 0.36, 0.165); belly.scale.setScalar(0.8); bob.add(belly);
  const head = new THREE.Group(); head.position.y = 0.74; bob.add(head);
  const skull = new THREE.Mesh(gHead, shellMat); head.add(skull);
  const face = new THREE.Mesh(gFace, faceMat); face.position.z = 0.085; face.scale.set(1, 0.82, 0.75); head.add(face);
  const visor = new THREE.Mesh(gVisor, null); visor.position.set(0, 0.01, 0.19); head.add(visor);
  const antenna = new THREE.Mesh(gAntenna, shellMat); antenna.position.y = 0.24; head.add(antenna);
  const tip = new THREE.Mesh(gTip, null); tip.position.y = 0.32; head.add(tip);
  const arms = [1, -1].map(side => {
    const p = new THREE.Group(); p.position.set(side * 0.205, 0.47, 0); p.rotation.z = side * 0.12;
    const m = new THREE.Mesh(gArm, shellMat); m.castShadow = true; p.add(m); bob.add(p); return p;
  });
  const feet = [1, -1].map(side => {
    const m = new THREE.Mesh(gFoot, footMat); m.position.set(side * 0.09, 0.045, 0.02); m.scale.set(1, 0.6, 1.35);
    m.castShadow = true; root.add(m); return m;
  });
  [body, skull, antenna].forEach(m => (m.castShadow = true));
  [body, skull, face].forEach(m => { m.userData.agent = a; hitTargets.push(m); });

  // Floating label: status dot + name
  const el = document.createElement('div'); el.className = 'alabel';
  const dot = document.createElement('span'); dot.className = 'dot';
  el.append(dot, document.createTextNode(a.name));
  const label = new CSS2DObject(el); label.position.y = 1.3; root.add(label);

  scene.add(root);
  Object.assign(a, {
    root, parts: { halo, bob, head, visor, belly, tip, arms, feet, el, dot },
    yaw: 0, yawGoal: 0, phase: Math.random() * 10, walk: 0, timer: 0, blinkT: rand(1, 5), emitAcc: 0,
    path: [], spot: null, node: 0, state: 'idle', pendingFloor: null, hover: false,
  });
}

function setStatusVisual(a) {
  const sm = statusMats[a.status] ?? statusMats.idle, c = hex(STATUS_COLORS[a.status] ?? STATUS_COLORS.idle);
  const p = a.parts;
  p.halo.material = sm.halo; p.visor.material = sm.glow; p.belly.material = sm.glow; p.tip.material = sm.glow;
  p.dot.style.background = c; p.dot.style.color = c;
  p.el.classList.toggle('err', a.status === 'error');
  if (a.listEl) {
    a.listEl.querySelector('.dot').style.cssText = `background:${c};color:${c}`;
    a.listEl.classList.toggle('err', a.status === 'error');
  }
}

/* ---------- Agent behaviour: walk → work/idle → pick next spot, sometimes ride the elevator ---------- */
const SPEED = 1.15;
function releaseSpot(a) {
  if (a.spot && a.spot.kind !== 'cab') a.spot.taken = null;
  if (a.spot?.kind === 'cab' && elevator.rider === a && a.state !== 'ride') { elevator.busy = false; elevator.rider = null; }
  a.spot = null;
}
function goTo(a, goal) {
  const nav = NAV[a.floor];
  a.path = [a.node, ...findPath(nav, a.node, goal)].map(i => ({ x: nav.nodes[i].x, z: nav.nodes[i].z, node: i }));
  a.state = 'walk';
}
function decide(a, noRide = false) {
  if (a.status === 'error') { a.state = 'error'; return; }
  const nav = NAV[a.floor];
  const wantRide = a.pendingFloor !== null || (!noRide && Math.random() < 0.18);
  if (wantRide && !elevator.busy && clockT - elevator.last > 4) {
    elevator.busy = true; elevator.rider = a; a.spot = { kind: 'cab' };
    return goTo(a, nav.cab);
  }
  const free = nav.spots.filter(s => !s.taken);
  if (!free.length) { a.state = 'idle'; a.timer = 2; return; }
  const deskW = a.status === 'idle' ? 1 : 3;
  const total = free.reduce((s, sp) => s + (sp.kind === 'desk' ? deskW : 1), 0);
  let r = Math.random() * total, choice = free[0];
  for (const sp of free) { r -= sp.kind === 'desk' ? deskW : 1; if (r <= 0) { choice = sp; break; } }
  choice.taken = a; a.spot = choice;
  goTo(a, choice.node);
}
function arrive(a) {
  const s = a.spot;
  if (s?.kind === 'cab') return startRide(a);
  if (s) a.yawGoal = s.face;
  if (s?.kind === 'desk' || s?.kind === 'rack') { a.state = 'work'; a.timer = rand(5, 10); }
  else { a.state = 'idle'; a.timer = rand(2.5, 5); }
}
function startRide(a) {
  let to = a.pendingFloor;
  if (to === null || to === a.floor) { do { to = Math.floor(Math.random() * FLOORS); } while (to === a.floor); }
  a.pendingFloor = null;
  Object.assign(a, { state: 'ride', rideFrom: a.floor, rideTo: to, rideT: 0, rideDur: 1.2 + Math.abs(to - a.floor) * 0.9, yawGoal: Math.PI / 4 });
}
function finishTask(a) {
  logActivity(`${a.name} finished “${a.task}”`, '#5dff9e');
  counters.costAdd += 0.0006;
  let next; do { next = pick(TASKS); } while (next === a.task); a.task = next;
}

/* ---------- Activity feed + stats counters ---------- */
const feedEl = qs('feed');
function logActivity(text, color = '#4ff0ff') {
  const li = document.createElement('li');
  const time = document.createElement('time'); time.textContent = new Date().toTimeString().slice(0, 8);
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.cssText = `background:${color};color:${color}`;
  const span = document.createElement('span'); span.textContent = text;
  li.append(time, dot, span); feedEl.prepend(li);
  while (feedEl.children.length > 16) feedEl.lastChild.remove();
}
function clearActivity() { feedEl.replaceChildren(); }
const parseUptime = s => { const m = String(s).match(/([\d.]+)\s*h/); return m ? parseFloat(m[1]) * 3600 : 0; };
const parseCost = s => parseFloat(String(s).replace(/[^\d.]/g, '')) || 0;
const counters = { uptimeBase: parseUptime(STATS.uptime), uptimeAdd: 0, costBase: parseCost(STATS.cost), costAdd: 0 };
function renderStats() {
  if (statsMode === 'live') {
    qs('stat-agents').textContent = String(STATS.agents ?? '');
    qs('stat-uptime').textContent = String(STATS.uptime ?? '');
    qs('stat-cost').textContent = String(STATS.cost ?? '');
    if (STATS.uptimeSub != null) qs('stat-uptime-sub').textContent = String(STATS.uptimeSub);
    if (STATS.costSub != null) qs('stat-cost-sub').textContent = String(STATS.costSub);
    if (STATS.breakdown != null) qs('stat-breakdown').textContent = String(STATS.breakdown);
    return;
  }
  const up = counters.uptimeBase + counters.uptimeAdd;
  qs('stat-uptime').textContent = `${Math.floor(up / 3600)}h`;
  const mm = String(Math.floor((up % 3600) / 60)).padStart(2, '0'), ss = String(Math.floor(up % 60)).padStart(2, '0');
  qs('stat-uptime-sub').textContent = `${mm}m ${ss}s · ${liveWord}`;
  qs('stat-cost').textContent = `$${(counters.costBase + counters.costAdd).toFixed(2)}`;
  qs('stat-cost-sub').textContent = `+$${counters.costAdd.toFixed(4)} ${sessionWord}`;
  const n = { working: 0, busy: 0, idle: 0, error: 0 };
  AGENTS.forEach(a => { n[a.status] = (n[a.status] ?? 0) + 1; });
  qs('stat-agents').textContent = String(STATS.agents ?? AGENTS.length);
  const tpl = breakdownTpl || '{working} working · {busy} busy · {idle} idle · {error} error';
  qs('stat-breakdown').textContent = tpl.replace('{working}', n.working).replace('{busy}', n.busy).replace('{idle}', n.idle).replace('{error}', n.error);
}

/* ---------- Spawn agents + left roster ---------- */
const listEl = qs('agent-list');
for (const a of AGENTS) {
  buildAgent(a);
  agentMeshes.set(a.id, a.root); agentById.set(a.id, a);
  const row = document.createElement('div'); row.className = 'ag';
  const d = document.createElement('span'); d.className = 'dot';
  const nm = document.createElement('span'); nm.textContent = a.name;
  const fl = document.createElement('span'); fl.className = 'fl';
  row.append(d, nm, fl); listEl.append(row); a.listEl = row; a.floorEl = fl;
  row.addEventListener('click', () => focusOn(a));
  // Snap to the nearest free spot on its floor
  const nav = NAV[a.floor];
  const free = nav.spots.filter(s => !s.taken).sort((p, q) =>
    Math.hypot(nav.nodes[p.node].x - a.x, nav.nodes[p.node].z - a.z) - Math.hypot(nav.nodes[q.node].x - a.x, nav.nodes[q.node].z - a.z));
  const s = free[0]; s.taken = a; a.spot = s; a.node = s.node;
  a.root.position.set(nav.nodes[s.node].x, a.floor * FLOOR_H + SLAB_TOP, nav.nodes[s.node].z);
  a.yaw = a.yawGoal = s.face;
  a.state = a.status === 'error' ? 'error' : (s.kind === 'desk' ? 'work' : 'idle');
  a.timer = rand(0.5, 4);
  fl.textContent = `F${a.floor + 1}`;
  setStatusVisual(a);
}

/* ============================================================
 * HOOKS for wiring real data
 * ============================================================ */
// Change an agent's status color, e.g. updateAgentStatus('agent-3', 'error')
// Error agents stop where they are and blink red until their status changes.
function updateAgentStatus(id, status, quiet) {
  const a = agentById.get(id); if (!a) return;
  const prev = a.status;
  a.status = STATUS_COLORS[status] !== undefined ? status : 'idle';
  setStatusVisual(a);
  if (prev === a.status) return;
  if (a.status === 'error') {
    if (a.state !== 'ride') {
      if (a.spot?.kind === 'cab') releaseSpot(a);
      a.state = 'error'; a.path = [];
    }
    if (!quiet) logActivity(`${a.name} hit an error on “${a.task}”`, '#ff4f6d');
  } else {
    if (!quiet) {
      if (prev === 'error') logActivity(`${a.name} recovered and is back to ${a.status}`, '#5dff9e');
      else logActivity(`${a.name} is now ${a.status}`, hex(STATUS_COLORS[a.status]));
    }
    if (a.state === 'error') { releaseSpot(a); decide(a); }
  }
  renderStats();
}

// Update right-panel stats, e.g. setStats({ cost: '$2.40' }). Uptime/cost keep ticking from the new value.
function setStats(partial) {
  partial = partial || {};
  if (partial.mode === 'live' || partial.mode === 'demo') statsMode = partial.mode;
  if (typeof partial.breakdownTpl === 'string' && partial.breakdownTpl) breakdownTpl = partial.breakdownTpl;
  Object.assign(STATS, partial);
  if (statsMode !== 'live') {
    if ('uptime' in partial && partial.uptime != null) { counters.uptimeBase = parseUptime(STATS.uptime); counters.uptimeAdd = 0; }
    if ('cost' in partial && partial.cost != null) { counters.costBase = parseCost(STATS.cost); counters.costAdd = 0; }
  }
  const setLabel = (id, value) => { const el = qs(id); if (el && value) el.textContent = String(value); };
  setLabel('stat-label-agents', STATS.agentsLabel);
  setLabel('stat-label-uptime', STATS.uptimeLabel);
  setLabel('stat-label-cost', STATS.costLabel);
  renderStats();
}
function updateLabels(labels) {
  if (!labels) return;
  if (labels.following) followPrefix = labels.following;
  if (labels.liveWord) liveWord = labels.liveWord;
  if (labels.sessionWord) sessionWord = labels.sessionWord;
  if (labels.breakdown) breakdownTpl = labels.breakdown;
  const set = (id, value) => { const el = qs(id); if (el && value) el.textContent = value; };
  set('brand', labels.brand || 'AXPM');
  set('brand-sub', labels.brandSub);
  set('roster-label', labels.roster);
  set('hint', labels.hint);
  set('btn-rotate', labels.autoRotate);
  set('btn-glow', labels.glow);
  set('btn-reset', labels.reset);
  set('status-heading', labels.status);
  set('activity-heading', labels.activity);
  if (statsMode !== 'live') {
    set('stat-label-agents', labels.agents);
    set('stat-label-uptime', labels.uptime);
    set('stat-label-cost', labels.cost);
  }
  const stop = qs('focus-x');
  if (stop && labels.stopFollow) stop.title = labels.stopFollow;
  if (sceneReady && focusAgent) {
    const name = qs('focus-name');
    if (name) name.textContent = `◉ ${followPrefix} ${focusAgent.name}`;
  }
}

// Set what an agent is working on (shown in the hover tooltip)
function setAgentTask(id, task) { const a = agentById.get(id); if (a && task) a.task = task; }
function setAgentRole(id, role) { const a = agentById.get(id); if (a && role) a.role = role; }
function setFloorNames(names) {
  if (!Array.isArray(names)) return;
  names.forEach((name, index) => { if (typeof name === 'string' && name) FLOOR_NAMES[index] = name; });
}
// Send an agent to another floor via the elevator, e.g. moveAgentToFloor('agent-2', 4)
function moveAgentToFloor(id, floor) {
  const a = agentById.get(id); if (!a || floor === a.floor || floor < 0 || floor >= FLOORS) return;
  a.pendingFloor = floor;
  if (a.state === 'idle' || a.state === 'work') { releaseSpot(a); decide(a); }
}
// Snapshot of agent positions/states (handy for debugging and tests)
const getAgents = () => AGENTS.map(a => ({ id: a.id, name: a.name, floor: a.floor, status: a.status, state: a.state,
  x: +a.root.position.x.toFixed(3), y: +a.root.position.y.toFixed(3), z: +a.root.position.z.toFixed(3) }));
// TODO: poll an API or open a WebSocket here, then call the hooks above.
// Example:
//   demoEnabled = false;
//   const ws = new WebSocket('wss://your-server/agents');
//   ws.onmessage = e => { const d = JSON.parse(e.data);
//     d.agents?.forEach(a => { updateAgentStatus(a.id, a.status); if (a.task) setAgentTask(a.id, a.task);
//                              if (a.floor !== undefined) moveAgentToFloor(a.id, a.floor); });
//     d.events?.forEach(ev => logActivity(ev.text));
//     if (d.stats) setStats(d.stats); };
function connectLiveData(opts) {
  opts = opts || {};
  if (typeof opts.getLocale === 'function') getLocale = opts.getLocale;
  if (typeof opts.getLabels === 'function') getLabels = opts.getLabels;
  if (pollTimer) clearInterval(pollTimer);
  const url = opts.url || '/api/ops-floor/summary';
  const every = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 10000;
  const tick = async () => {
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        if (!liveMemory.primed) demoEnabled = true;
        if (typeof opts.onError === 'function') opts.onError(new Error(String(res.status)));
        return;
      }
      const data = await res.json();
      lastSummary = data;
      const locale = getLocale() === 'zh' ? 'zh' : 'en';
      applyOpsFloorSnapshot(window.nexus, data, locale, getLabels(), liveMemory);
      if (typeof opts.onSummary === 'function') opts.onSummary(data);
    } catch (err) {
      if (!liveMemory.primed) demoEnabled = true;
      if (typeof opts.onError === 'function') opts.onError(err);
    }
  };
  void tick();
  pollTimer = setInterval(() => { void tick(); }, every);
  return () => { if (pollTimer) clearInterval(pollTimer); pollTimer = null; };
}
function reapplyLocale() {
  const labels = getLabels();
  if (!lastSummary) { updateLabels(labels); return; }
  applyOpsFloorSnapshot(window.nexus, lastSummary, getLocale() === 'zh' ? 'zh' : 'en', labels, liveMemory, { quietStatus: true, resetFeed: true });
}
window.nexus = { updateAgentStatus, setStats, connectLiveData, setAgentTask, setAgentRole, setFloorNames, moveAgentToFloor, logActivity, clearActivity, getAgents, updateLabels, reapplyLocale, setPrices, build: NEXUS_BUILD,
  setDemo: on => { demoEnabled = !!on; } };

setStats({});
logActivity('AXPM online · 15 agents across 5 floors', '#4ff0ff');
logActivity(`${AGENTS[11].name} hit an error on “${AGENTS[11].task}”`, '#ff4f6d');

/* ---------- Interaction: hover tooltip, click to follow, toolbar ---------- */
const tipEl = qs('tip');
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hovered = null, mouse = { x: 0, y: 0 }, downAt = null;
const STATE_TEXT = { walk: 'walking', work: 'working at desk', idle: 'taking a break', ride: 'in the elevator', error: 'stalled' };
function renderTip() {
  if (!hovered) { tipEl.style.display = 'none'; return; }
  const a = hovered, c = hex(STATUS_COLORS[a.status] ?? STATUS_COLORS.idle);
  tipEl.replaceChildren();
  const b = document.createElement('b'); b.textContent = a.name; b.style.color = c; tipEl.append(b);
  const row = (k, v) => { const r = document.createElement('div'); r.className = 'row';
    const s1 = document.createElement('span'); s1.textContent = k; const s2 = document.createElement('span'); s2.textContent = v;
    r.append(s1, s2); tipEl.append(r); };
  row('Role', a.role); row('Status', a.status); row('Doing', a.state === 'work' && a.spot?.kind === 'rack' ? 'servicing racks' : STATE_TEXT[a.state]);
  row('Floor', `${a.floor + 1} · ${FLOOR_NAMES[a.floor]}`); row('Task', a.task);
  const r = container.getBoundingClientRect();
  tipEl.style.display = 'block';
  const x = Math.min(mouse.x + 16, r.width - tipEl.offsetWidth - 8), y = Math.min(mouse.y + 16, r.height - tipEl.offsetHeight - 8);
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
function pickAgent() {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((mouse.x / r.width) * 2 - 1, -(mouse.y / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(hitTargets, false)[0];
  return hit ? hit.object.userData.agent : null;
}
function setHovered(a) {
  if (hovered === a) return;
  if (hovered) { hovered.hover = false; hovered.parts.el.classList.remove('hot'); }
  hovered = a;
  if (a) { a.hover = true; a.parts.el.classList.add('hot'); }
  renderer.domElement.style.cursor = a ? 'pointer' : '';
  renderTip();
}
renderer.domElement.addEventListener('pointermove', e => {
  const r = container.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  setHovered(pickAgent()); if (hovered) renderTip();
});
renderer.domElement.addEventListener('pointerleave', () => setHovered(null));
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  const a = pickAgent(); a ? focusOn(a) : unfocus();
});
const onKey = (e) => { if (e.key === 'Escape') unfocus(); };
window.addEventListener('keydown', onKey);
cleanups.push(() => window.removeEventListener('keydown', onKey));

// Camera focus: smoothly pan to and follow an agent
let focusAgent = null, camMode = null, zoomT = 0;
const HOME = new THREE.Vector3(0, 6, 0);
const chip = qs('focus-chip');
function focusOn(a) {
  focusAgent = a; camMode = 'follow'; zoomT = 1.5;
  chip.style.display = 'flex'; qs('focus-name').textContent = `◉ ${followPrefix} ${a.name}`;
  AGENTS.forEach(x => x.listEl.classList.toggle('sel', x === a));
}
function unfocus() {
  if (!focusAgent && !camMode) return;
  focusAgent = null; camMode = 'home'; zoomT = 1.5; chip.style.display = 'none';
  AGENTS.forEach(x => x.listEl.classList.remove('sel'));
}
qs('focus-x').onclick = unfocus;
qs('btn-reset').onclick = () => { focusAgent = null; camMode = 'home'; zoomT = 1.5; chip.style.display = 'none'; AGENTS.forEach(x => x.listEl.classList.remove('sel')); };
const btnRotate = qs('btn-rotate'), btnGlow = qs('btn-glow');
btnRotate.onclick = () => { controls.autoRotate = !controls.autoRotate; btnRotate.classList.toggle('on', controls.autoRotate); };
btnGlow.onclick = () => { bloom.enabled = !bloom.enabled; btnGlow.classList.toggle('on', bloom.enabled); };
const goalV = new THREE.Vector3(), deltaV = new THREE.Vector3();
function updateCamera(dt) {
  if (!camMode) return;
  if (focusAgent) goalV.copy(focusAgent.root.position).add(deltaV.set(0, 0.7, 0)); else goalV.copy(HOME);
  const k = 1 - Math.exp(-dt * 4);
  deltaV.copy(controls.target).lerp(goalV, k).sub(controls.target);
  controls.target.add(deltaV); camera.position.add(deltaV);
  if (zoomT > 0) {
    zoomT -= dt;
    camera.zoom += ((focusAgent ? 1.9 : 1) - camera.zoom) * k; camera.updateProjectionMatrix();
  }
  if (camMode === 'home' && controls.target.distanceTo(HOME) < 0.01 && zoomT <= 0) camMode = null;
}

/* ---------- Demo simulation (status changes, errors, recoveries) ---------- */
const demo = { statusT: 5, errorT: 22, recover: [{ a: AGENTS[11], t: 10 }] };
function updateDemo(dt) {
  if (!demoEnabled) return;
  demo.recover = demo.recover.filter(r => { r.t -= dt; if (r.t <= 0) { updateAgentStatus(r.a.id, 'working'); return false; } return true; });
  if ((demo.statusT -= dt) <= 0) {
    demo.statusT = rand(6, 11);
    const a = pick(AGENTS.filter(x => x.status !== 'error'));
    if (a) updateAgentStatus(a.id, pick(['working', 'busy', 'idle'].filter(s => s !== a.status)));
  }
  if ((demo.errorT -= dt) <= 0) {
    demo.errorT = rand(25, 40);
    const a = pick(AGENTS.filter(x => x.status !== 'error' && x.state !== 'ride' && x.state !== 'walk'));
    if (a) { updateAgentStatus(a.id, 'error'); demo.recover.push({ a, t: rand(6, 9) }); }
  }
}

/* ---------- Per-frame agent update ---------- */
const fwd = new THREE.Vector3();
function updateAgent(a, t, dt) {
  const p = a.parts, r = a.root.position;
  // State machine
  if (a.state === 'walk') {
    const tgt = a.path[0];
    if (!tgt) arrive(a);
    else {
      const dx = tgt.x - r.x, dz = tgt.z - r.z, dist = Math.hypot(dx, dz), step = SPEED * dt;
      if (dist <= step) { r.x = tgt.x; r.z = tgt.z; a.node = tgt.node; a.path.shift(); if (!a.path.length) arrive(a); }
      else { r.x += dx / dist * step; r.z += dz / dist * step; a.yawGoal = Math.atan2(dx, dz); }
      a.walk += dt * 11;
    }
    r.y = a.floor * FLOOR_H + SLAB_TOP;
  } else if (a.state === 'work' || a.state === 'idle') {
    if ((a.timer -= dt) <= 0) {
      if (a.state === 'work' && demoEnabled && Math.random() < 0.6) finishTask(a);
      releaseSpot(a); decide(a);
    }
  } else if (a.state === 'ride') {
    a.rideT = Math.min(1, a.rideT + dt / a.rideDur);
    const e = a.rideT < 0.5 ? 2 * a.rideT * a.rideT : 1 - Math.pow(-2 * a.rideT + 2, 2) / 2;
    r.y = THREE.MathUtils.lerp(a.rideFrom, a.rideTo, e) * FLOOR_H + SLAB_TOP + 0.06;
    if (a.rideT >= 1) {
      a.floor = a.rideTo; a.node = NAV[a.floor].cab; a.spot = null; r.y = a.floor * FLOOR_H + SLAB_TOP;
      elevator.busy = false; elevator.rider = null; elevator.last = clockT;
      a.floorEl.textContent = `F${a.floor + 1}`;
      logActivity(`${a.name} moved to Floor ${a.floor + 1} · ${FLOOR_NAMES[a.floor]}`, '#b07cff');
      decide(a, true);
    }
  }
  // Face the walk direction (shortest-angle smoothing)
  let d = a.yawGoal - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  a.yaw += d * Math.min(1, dt * 10); a.root.rotation.y = a.yaw;

  // Body animation per state
  const [aL, aR] = p.arms, [fL, fR] = p.feet, ph = a.phase;
  if (a.state === 'walk') {
    const s = Math.sin(a.walk);
    p.bob.position.y = Math.abs(Math.sin(a.walk)) * 0.06; p.bob.rotation.z = s * 0.06;
    fL.position.z = 0.02 + s * 0.09; fR.position.z = 0.02 - s * 0.09;
    fL.position.y = 0.045 + Math.max(0, s) * 0.04; fR.position.y = 0.045 + Math.max(0, -s) * 0.04;
    aL.rotation.x = -s * 0.6; aR.rotation.x = s * 0.6;
    p.head.rotation.set(0, 0, 0);
  } else {
    p.bob.rotation.z *= 0.9;
    fL.position.set(0.09, 0.045, 0.02); fR.position.set(-0.09, 0.045, 0.02);
    if (a.state === 'work') {
      // Typing: quick tiny bob, arms forward and tapping, head tilted to the screen
      p.bob.position.y = Math.abs(Math.sin(t * 14 + ph)) * 0.015;
      aL.rotation.x = -1.25 + Math.sin(t * 22 + ph) * 0.14; aR.rotation.x = -1.25 + Math.sin(t * 22 + ph + 2) * 0.14;
      p.head.rotation.set(0.18, Math.sin(t * 1.3 + ph) * 0.12, 0);
      a.emitAcc += dt * 5;
      while (a.emitAcc >= 1) {
        a.emitAcc -= 1; fwd.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
        emitParticle(r.x + fwd.x * 0.55, r.y + 1.05, r.z + fwd.z * 0.55, STATUS_COLORS[a.status] ?? STATUS_COLORS.working);
      }
    } else if (a.state === 'error') {
      p.bob.position.y = 0.01;
      aL.rotation.x = aR.rotation.x = -0.2;
      p.head.rotation.set(0, Math.sin(t * 18) * 0.12 * (Math.sin(t * 10) > 0 ? 1 : 0), 0);
    } else {
      // Idle / riding: gentle breathing, looking around
      p.bob.position.y = 0.01 + Math.sin(t * 2 + ph) * 0.015;
      aL.rotation.x *= 0.9; aR.rotation.x *= 0.9;
      p.head.rotation.set(0, Math.sin(t * 0.6 + ph) * 0.5, 0);
    }
  }
  // Eye blink every few seconds
  if ((a.blinkT -= dt) <= 0) { p.visor.scale.y = 0.2; if (a.blinkT < -0.12) { p.visor.scale.y = 1; a.blinkT = rand(2.5, 6); } }
  // Halo pulse + hover highlight
  p.halo.scale.setScalar((a.hover || a === focusAgent ? 1.35 : 1) * (1 + Math.sin(t * 3 + ph) * 0.05));
}

/* ---------- Render loop ---------- */
const clock = new THREE.Clock();
let clockT = 0, statsAcc = 0, tipAcc = 0;
function animate() {
  rafId = requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  clockT += dt; const t = clockT;

  AGENTS.forEach(a => updateAgent(a, t, dt));
  updateDemo(dt);
  updateParticles(dt);

  // Error status blinks red (shared material, so every error agent blinks in sync)
  const on = Math.sin(t * 10) > 0;
  statusMats.error.glow.emissiveIntensity = on ? 2.8 : 0.2;
  statusMats.error.halo.opacity = on ? 0.95 : 0.12;
  // Monitor flicker, neon edge ripple up the tower, data pulses, elevator rings
  screenMat.emissiveIntensity = 0.55 + Math.sin(t * 7) * 0.05 + (Math.random() < 0.02 ? 0.25 : 0);
  screenMat2.emissiveIntensity = 0.55 + Math.sin(t * 5 + 1) * 0.05;
  tickCharts(dt);
  tickerTex.offset.x = (tickerTex.offset.x + dt * 0.045) % 1;
  for (let f = 0; f < FLOORS; f++) {
    const w = 0.5 + 0.5 * Math.sin(t * 1.6 - f * 0.9);
    floorEdgeMats[f].opacity = 0.3 + w * 0.45;
    floorNeonMats[f].color.copy(NEON).multiplyScalar(1.2 + w * 1.6);
  }
  for (const pu of pulses) {
    pu.t = (pu.t + pu.speed * dt * pu.dir + 1) % 1;
    pu.curve.getPointAt(pu.t, pu.s.position);
    const fade = Math.sin(pu.t * Math.PI); pu.s.scale.setScalar(0.18 + fade * 0.3);
  }
  driftRings.forEach((m, i) => {
    m.position.y = ((t * 0.9 + i * TOWER_H / 6) % TOWER_H);
    m.material.opacity = 0.15 + 0.35 * Math.sin((m.position.y / TOWER_H) * Math.PI);
  });
  const rider = elevator.rider;
  const platY = rider && rider.state === 'ride' ? rider.root.position.y - 0.04 : platform.position.y;
  platform.position.y += (platY - platform.position.y) * Math.min(1, dt * 12);
  beam.material.opacity = rider && rider.state === 'ride' ? 0.13 : 0.07;

  // Stats tick: uptime counts up, cost creeps up with compute usage
  if (statsMode !== 'live') {
    counters.uptimeAdd += dt;
    counters.costAdd += dt * 0.00002;
  }
  if ((statsAcc += dt) > 0.5) { statsAcc = 0; renderStats(); }
  if (hovered && (tipAcc += dt) > 0.3) { tipAcc = 0; renderTip(); }

  updateCamera(dt);
  controls.update();
  if (bloom.enabled) composer.render(); else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();

const onResize = () => {
  const w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1), a = w / h;
  camera.left = -frustum * a / 2; camera.right = frustum * a / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); labelRenderer.setSize(w, h);
};
resizeObs = new ResizeObserver(onResize);
resizeObs.observe(container);
onResize();


  sceneReady = true;
  if (initialLabels) updateLabels(initialLabels);
  function dispose() {
    cancelAnimationFrame(rafId);
    if (pollTimer) clearInterval(pollTimer);
    if (resizeObs) resizeObs.disconnect();
    cleanups.forEach((fn) => fn());
    controls.dispose();
    if (composer && composer.dispose) composer.dispose();
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    if (labelRenderer.domElement) labelRenderer.domElement.remove();
    if (typeof window !== "undefined" && window.nexus && window.nexus.build === NEXUS_BUILD) delete window.nexus;
    root.replaceChildren();
  }
  return { nexus: window.nexus, dispose, reapplyLocale, root };
}
