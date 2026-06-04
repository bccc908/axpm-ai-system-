import "server-only";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { SlideCardCopy } from "@/lib/ai/social-copy-prompt";
import { buildVisualSlides, type VisualSlide } from "@/lib/social/visual-slides";

const FONT =
  "PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif";

const ACCENTS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185"];

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    if ((current + ch).length > maxChars) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) break;
    } else {
      current += ch;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function tspans(lines: string[], x: number, startY: number, lineHeight: number, extra = "") {
  return lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${x}" y="${y}"${extra}>${escapeXml(line)}</tspan>`;
    })
    .join("");
}

function hookCoverSvg(
  spec: Extract<VisualSlide, { kind: "cover" }>,
  width: number,
  height: number,
  total: number,
) {
  const headlineLines = wrapText(spec.headline, 9, 2);
  const bodyLines = wrapText(spec.body, 14, 2);
  const hookTag = spec.tag && spec.tag !== "开场" ? spec.tag : "必看";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hookBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a0000"/>
      <stop offset="35%" stop-color="#7f1d1d"/>
      <stop offset="70%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
    <radialGradient id="burst" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#hookBg)"/>
  <rect width="100%" height="100%" fill="url(#burst)"/>

  <g opacity="0.15" stroke="#ffffff" stroke-width="3">
    <line x1="-80" y1="0" x2="${width + 80}" y2="${height}"/>
    <line x1="${width + 80}" y1="0" x2="-80" y2="${height}"/>
  </g>

  <rect x="0" y="0" width="${width}" height="88" fill="#dc2626"/>
  <text x="${width / 2}" y="58" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="900" font-family="${FONT}">别划走 · 3秒抓重点</text>

  <rect x="72" y="130" width="220" height="52" rx="26" fill="url(#hotGrad)"/>
  <text x="182" y="165" text-anchor="middle" fill="#450a0a" font-size="28" font-weight="900" font-family="${FONT}">${escapeXml(hookTag)}</text>

  <rect x="48" y="240" width="${width - 96}" height="920" rx="40" fill="rgba(0,0,0,0.35)" stroke="#fef08a" stroke-width="4"/>

  <text fill="#ffffff" font-size="88" font-weight="900" font-family="${FONT}" stroke="#7f1d1d" stroke-width="2">
    ${tspans(headlineLines, 88, 420, 96)}
  </text>

  <rect x="88" y="${420 + headlineLines.length * 96 + 16}" width="160" height="8" rx="4" fill="#fbbf24"/>

  <text fill="#fef08a" font-size="40" font-weight="700" font-family="${FONT}">
    ${tspans(bodyLines, 88, 420 + headlineLines.length * 96 + 72, 52)}
  </text>

  <text x="${width / 2}" y="${height - 120}" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="24" font-family="${FONT}">个人分享 · 仅供参考</text>
  ${Array.from({ length: total }, (_, i) => {
    const x = width / 2 - (total * 16) / 2 + i * 32;
    const fill = i === 0 ? "#fef08a" : "rgba(255,255,255,0.3)";
    return `<circle cx="${x}" cy="${height - 60}" r="7" fill="${fill}"/>`;
  }).join("")}
</svg>`;
}

function slideSvg(spec: VisualSlide, width: number, height: number, slideIndex: number, total: number) {
  if (spec.kind === "cover") {
    return hookCoverSvg(spec, width, height, total);
  }

  const accent = ACCENTS[slideIndex % ACCENTS.length];
  const isOutro = spec.kind === "outro";
  const headlineLines = wrapText(spec.headline, 10, 2);
  const bodyLines = wrapText(spec.body, 16, 4);
  const headlineSize = 52;
  const bodySize = 34;
  const cardY = 280;
  const headlineY = 480;

  const dots = Array.from({ length: total }, (_, i) => {
    const x = width / 2 - (total * 16) / 2 + i * 32;
    const fill = i === slideIndex ? accent : "rgba(255,255,255,0.25)";
    return `<circle cx="${x}" cy="${height - 100}" r="6" fill="${fill}"/>`;
  }).join("");

  const pointBadge =
    spec.kind === "point"
      ? `<rect x="48" y="${cardY + 24}" width="8" height="${height - cardY - 204}" rx="4" fill="url(#accentGrad)"/>
         <circle cx="140" cy="${headlineY - 60}" r="40" fill="url(#accentGrad)"/>
         <text x="140" y="${headlineY - 46}" text-anchor="middle" fill="#0f172a" font-size="36" font-weight="900" font-family="${FONT}">${spec.index}</text>`
      : "";

  const tag = spec.tag || (isOutro ? "免责提示" : "干货");
  const tagWidth = Math.min(320, Math.max(120, tag.length * 30 + 48));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050816"/>
      <stop offset="45%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0c4a6e"/>
    </linearGradient>
    <radialGradient id="glow1" cx="85%" cy="12%" r="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="10%" cy="88%" r="40%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="headlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect width="100%" height="100%" fill="url(#glow1)"/>
  <rect width="100%" height="100%" fill="url(#glow2)"/>

  <g opacity="0.07" stroke="#ffffff" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 160}" x2="${width}" y2="${i * 160}"/>`).join("")}
    ${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 135}" y1="0" x2="${i * 135}" y2="${height}"/>`).join("")}
  </g>

  <rect x="48" y="${cardY}" width="${width - 96}" height="${height - cardY - 180}" rx="36"
    fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>

  <rect x="88" y="${cardY + 36}" width="${tagWidth}" height="44" rx="22" fill="url(#accentGrad)" opacity="0.95"/>
  <text x="108" y="${cardY + 66}" fill="#0f172a" font-size="24" font-weight="700" font-family="${FONT}">${escapeXml(tag)}</text>

  ${pointBadge}

  <text fill="url(#headlineGrad)" font-size="${headlineSize}" font-weight="800" font-family="${FONT}">
    ${tspans(headlineLines, 88, headlineY, headlineSize + 8)}
  </text>

  <rect x="88" y="${headlineY + headlineLines.length * (headlineSize + 8) + 24}" width="120" height="5" rx="2.5" fill="url(#accentGrad)"/>

  <text fill="#cbd5e1" font-size="${bodySize}" font-weight="400" font-family="${FONT}">
    ${tspans(bodyLines, 88, headlineY + headlineLines.length * (headlineSize + 8) + 72, bodySize + 18)}
  </text>

  <text x="88" y="${height - 150}" fill="#64748b" font-size="22" font-family="${FONT}">个人分享 · 仅供参考 · 投资有风险</text>
  ${dots}
</svg>`;
}

async function loadPresenterFace(photoPath: string, size: number) {
  const photoBuf = await fs.readFile(photoPath);
  const rounded = await sharp(photoBuf)
    .resize(size, size, { fit: "cover", position: "attention" })
    .sharpen({ sigma: 0.6 })
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
  );
  return sharp(rounded).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function presenterPipSvg(size: number) {
  const pad = 8;
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size + pad * 2 + 120}" height="${size + pad * 2 + 48}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <circle cx="${(size + pad * 2) / 2}" cy="${(size + pad * 2) / 2}" r="${size / 2 + pad}" fill="none" stroke="#f59e0b" stroke-width="5"/>
  </g>
  <rect x="0" y="${size + pad * 2 + 4}" width="${size + pad * 2 + 100}" height="40" rx="20" fill="rgba(245,158,11,0.92)"/>
  <text x="${(size + pad * 2 + 100) / 2}" y="${size + pad * 2 + 32}" text-anchor="middle" fill="#0f172a" font-size="22" font-weight="700" font-family="${FONT}">我在讲</text>
</svg>`);
}

export async function renderPresenterSlidesToDir(params: {
  exportDir: string;
  title: string;
  script: string;
  photoPath: string;
  slideCards?: SlideCardCopy[];
  width?: number;
  height?: number;
}) {
  const width = params.width ?? 1080;
  const height = params.height ?? 1920;
  await fs.mkdir(params.exportDir, { recursive: true });

  const specs = buildVisualSlides({
    title: params.title,
    script: params.script,
    slideCards: params.slideCards,
  });

  const faceSize = 260;
  const face = await loadPresenterFace(params.photoPath, faceSize);
  const pipDecor = presenterPipSvg(faceSize);
  const pipLeft = width - faceSize - 72;
  const pipTop = height - faceSize - 200;

  const files: { name: string; path: string; urlPath: string }[] = [];

  for (let i = 0; i < specs.length; i++) {
    const name = `presenter-slide-${String(i + 1).padStart(2, "0")}.png`;
    const filePath = path.join(params.exportDir, name);
    const svg = slideSvg(specs[i], width, height, i, specs.length);
    const composites: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), top: 0, left: 0 }];

    // 开场 3 秒纯钩子画面，不遮挡；从第 2 张起显示「我在讲」
    if (i > 0) {
      composites.push(
        { input: pipDecor, top: pipTop - 8, left: pipLeft - 8 },
        { input: face, top: pipTop, left: pipLeft },
      );
    }

    await sharp({
      create: { width, height, channels: 3, background: { r: 10, g: 15, b: 24 } },
    })
      .composite(composites)
      .png({ quality: 95, compressionLevel: 6 })
      .toFile(filePath);

    files.push({ name, path: filePath, urlPath: name });
  }

  return { slides: files, specs, count: files.length, width, height };
}

export async function renderSlidesToDir(params: {
  exportDir: string;
  title: string;
  script: string;
  slideCards?: SlideCardCopy[];
  width?: number;
  height?: number;
}) {
  const width = params.width ?? 1080;
  const height = params.height ?? 1920;
  await fs.mkdir(params.exportDir, { recursive: true });

  const specs = buildVisualSlides({
    title: params.title,
    script: params.script,
    slideCards: params.slideCards,
  });

  const files: { name: string; path: string; urlPath: string }[] = [];

  for (let i = 0; i < specs.length; i++) {
    const name = `slide-${String(i + 1).padStart(2, "0")}.png`;
    const filePath = path.join(params.exportDir, name);
    const svg = slideSvg(specs[i], width, height, i, specs.length);
    await sharp(Buffer.from(svg)).png({ quality: 95, compressionLevel: 6 }).toFile(filePath);
    files.push({ name, path: filePath, urlPath: name });
  }

  return { slides: files, count: files.length, width, height };
}
