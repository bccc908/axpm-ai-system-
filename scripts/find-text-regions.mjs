import fs from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const bg = fs.readFileSync(".run/d95dae2f-b9fb-4ce2-8abd-dfb3755b98b2.pdf.png");
const img = await loadImage(bg);
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);
const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

function scan(minY, maxY, minX, maxX = width) {
  const hits = [];
  for (let y = minY; y < maxY; y++) {
    let min = 9999,
      max = 0;
    for (let x = minX; x < maxX; x++) {
      const i = (y * width + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (lum < 120) {
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }
    if (max - min > 50) hits.push({ y, min, max, w: max - min });
  }
  return hits;
}

function cluster(hits) {
  if (!hits.length) return [];
  const groups = [];
  let g = { yMin: hits[0].y, yMax: hits[0].y, min: hits[0].min, max: hits[0].max };
  for (let i = 1; i < hits.length; i++) {
    const h = hits[i];
    if (h.y - g.yMax <= 3) {
      g.yMax = h.y;
      g.min = Math.min(g.min, h.min);
      g.max = Math.max(g.max, h.max);
    } else {
      groups.push({ ...g, h: g.yMax - g.yMin + 1 });
      g = { yMin: h.y, yMax: h.y, min: h.min, max: h.max };
    }
  }
  groups.push({ ...g, h: g.yMax - g.yMin + 1 });
  return groups;
}

console.log(`Image: ${width}x${height}\n`);

for (const [label, minY, maxY, minX] of [
  ["header payment date", 180, 320, 700],
  ["guest area", 320, 480, 700],
  ["order dates", 480, 620, 1100],
  ["amounts subtotal/total", 1020, 1120, 1180],
  ["amount labels left", 1020, 1120, 990],
]) {
  console.log(`=== ${label} (${minY}-${maxY}, x>${minX}) ===`);
  for (const g of cluster(scan(minY, maxY, minX))) {
    console.log(
      `  y=${g.yMin}-${g.yMax} h=${g.h} x=${g.min}-${g.max} w=${g.max - g.min}`,
    );
  }
}
