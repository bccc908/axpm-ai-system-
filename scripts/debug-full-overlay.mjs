import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { detectTripComFields } from "../src/lib/finance/receipt-pdf-detect.ts";

GlobalFonts.registerFromPath("/System/Library/Fonts/Hiragino Sans GB.ttc", "ReceiptZh");

const BASE_W = 1600;
const pdfBuf = await fs.readFile("data/receipts/d95dae2f-b9fb-4ce2-8abd-dfb3755b98b2.pdf");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf), useSystemFonts: true }).promise;
const page = await doc.getPage(1);
const vp1 = page.getViewport({ scale: 1 });
const scale = BASE_W / vp1.width;
const vp = page.getViewport({ scale });
const canvas = createCanvas(vp.width, vp.height);
const ctx = canvas.getContext("2d");
await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
const rendered = canvas.toBuffer("image/png");
await fs.writeFile(".run/debug-render.png", rendered);
console.log("render size:", vp.width, "x", vp.height);

const img = await loadImage(rendered);
const c2 = createCanvas(img.width, img.height);
const x2 = c2.getContext("2d");
x2.drawImage(img, 0, 0);
const { data, width, height } = x2.getImageData(0, 0, img.width, img.height);

const fields = detectTripComFields(data, width, height);
console.log("detected:", JSON.stringify(fields, null, 2));
if (!fields?.checkIn) throw new Error("detection failed");

const EDITS = {
  paymentDate: "2026年6月1日",
  checkIn: "2026年6月1日",
  checkOut: "2026年6月14日",
  subtotal: "MYR 1,484.77",
  total: "MYR 1,480.27",
};

function patch(f, color = "#ffffff") {
  x2.fillStyle = color;
  for (let i = 0; i < 3; i++) x2.fillRect(f.x, f.y, f.w, f.h);
}
function drawLeft(text, f) {
  x2.fillStyle = "#222222";
  x2.font = `${Math.round(img.width * 0.0115)}px ReceiptZh, sans-serif`;
  x2.textAlign = "left";
  x2.textBaseline = "middle";
  x2.fillText(text, f.x + 4, f.y + f.h / 2);
}
function drawRight(text, f, bold = false) {
  x2.fillStyle = "#222222";
  x2.font = `${bold ? "600 " : ""}${Math.round(img.width * 0.0115)}px ReceiptZh, sans-serif`;
  x2.textAlign = "right";
  x2.textBaseline = "middle";
  x2.fillText(text, f.x + f.w - 4, f.y + f.h / 2);
}

// Draw red outlines for debug
for (const [k, f] of Object.entries(fields)) {
  if (!f) continue;
  x2.strokeStyle = "#ff0000";
  x2.lineWidth = 2;
  x2.strokeRect(f.x, f.y, f.w, f.h);
  x2.fillStyle = "#ff0000";
  x2.font = "14px sans-serif";
  x2.textAlign = "left";
  x2.fillText(k, f.x, f.y - 4);
}

for (const f of Object.values(fields)) if (f) patch(f);
if (fields.paymentDate) drawLeft(EDITS.paymentDate, fields.paymentDate);
drawRight(EDITS.checkIn, fields.checkIn);
drawRight(EDITS.checkOut, fields.checkOut);
drawRight(EDITS.subtotal, fields.subtotal, true);
drawRight(EDITS.total, fields.total, true);

await fs.writeFile(".run/debug-full-overlay.png", c2.toBuffer("image/png"));
console.log("Saved .run/debug-full-overlay.png");
