import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { detectTripComFields } from "../src/lib/finance/receipt-pdf-detect.ts";

GlobalFonts.registerFromPath("/System/Library/Fonts/Hiragino Sans GB.ttc", "ReceiptZh");

const EDITS = {
  paymentDate: "2026年6月1日",
  checkIn: "2026年6月1日",
  checkOut: "2026年6月14日",
  subtotal: "MYR 1,484.77",
  total: "MYR 1,480.27",
};

const bg = await fs.readFile(".run/pdfjs-render-match.png");
const img = await loadImage(bg);
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);
const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

const fields = detectTripComFields(data, width, height);
console.log("detected:", JSON.stringify(fields, null, 2));
if (!fields?.checkIn) throw new Error("detection failed");

function patch(f) {
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 3; i++) ctx.fillRect(f.x, f.y, f.w, f.h);
}
function drawLeft(text, f) {
  ctx.fillStyle = "#222222";
  ctx.font = `${Math.round(img.width * 0.0115)}px ReceiptZh, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, f.x + 4, f.y + f.h / 2);
}
function drawRight(text, f, bold = false) {
  ctx.fillStyle = "#222222";
  ctx.font = `${bold ? "600 " : ""}${Math.round(img.width * 0.0115)}px ReceiptZh, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(text, f.x + f.w - 4, f.y + f.h / 2);
}

for (const f of Object.values(fields)) if (f) patch(f);
if (fields.paymentDate) drawLeft(EDITS.paymentDate, fields.paymentDate);
drawRight(EDITS.checkIn, fields.checkIn);
drawRight(EDITS.checkOut, fields.checkOut);
drawRight(EDITS.subtotal, fields.subtotal, true);
drawRight(EDITS.total, fields.total, true);

await fs.writeFile(".run/receipt-edited-preview.png", canvas.toBuffer("image/png"));

const pageWidth = 595.28;
const pageHeight = (img.height / img.width) * pageWidth;
const doc = await PDFDocument.create();
const page = doc.addPage([pageWidth, pageHeight]);
const embedded = await doc.embedPng(canvas.toBuffer("image/png"));
page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
const pdf = await doc.save();

const out = path.join(process.env.HOME ?? "", "Downloads", "Trip-com_MYR1480.27_FIXED.pdf");
await fs.writeFile(out, pdf);
await fs.writeFile(path.join(process.env.HOME ?? "", "Desktop", "Trip-com_MYR1480.27_FIXED.pdf"), pdf);
console.log("Saved", out);
