import fs from "fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const pdf = await fs.readFile("data/receipts/d95dae2f-b9fb-4ce2-8abd-dfb3755b98b2.pdf");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
const page = await doc.getPage(1);

const vp1 = page.getViewport({ scale: 1 });
const matchScale = 1600 / vp1.width;
console.log("page pt", vp1.width, "x", vp1.height, "matchScale", matchScale);

for (const scale of [2.2, matchScale]) {
  const vp = page.getViewport({ scale });
  console.log(`scale ${scale.toFixed(4)}: ${Math.round(vp.width)} x ${Math.round(vp.height)}`);
}

const scale = matchScale;
const vp = page.getViewport({ scale });
const canvas = createCanvas(vp.width, vp.height);
const ctx = canvas.getContext("2d");
await page.render({
  canvas: canvas,
  canvasContext: ctx,
  viewport: vp,
}).promise;
await fs.writeFile(".run/pdfjs-render-match.png", canvas.toBuffer("image/png"));

const ref = await loadImage(".run/d95dae2f-b9fb-4ce2-8abd-dfb3755b98b2.pdf.png");
const rendered = await loadImage(".run/pdfjs-render-match.png");
console.log("qlmanage:", ref.width, "x", ref.height);
console.log("pdfjs match:", rendered.width, "x", rendered.height);
