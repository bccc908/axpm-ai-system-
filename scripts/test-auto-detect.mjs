import fs from "fs/promises";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { detectTripComFields } from "../src/lib/finance/receipt-pdf-overlay.ts";

const png = await fs.readFile(".run/pdfjs-render-match.png");
const img = await loadImage(png);
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);
const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

const fields = detectTripComFields(data, width, height);
console.log("detected:", JSON.stringify(fields, null, 2));

if (fields) {
  for (const [k, f] of Object.entries(fields)) {
    if (!f) continue;
    ctx.strokeStyle = k === "checkIn" ? "lime" : k === "checkOut" ? "blue" : k === "paymentDate" ? "red" : "orange";
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
  }
  await fs.writeFile(".run/auto-detect-boxes.png", canvas.toBuffer("image/png"));
  console.log("Wrote .run/auto-detect-boxes.png");
}
