import fs from "fs/promises";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";

const FIELDS = {
  paymentDate: { x: 200, y: 224, w: 180, h: 32, color: "red", text: "2026年6月1日" },
  checkIn: { x: 1195, y: 546, w: 290, h: 24, color: "lime", text: "2026年6月1日" },
  checkOut: { x: 1295, y: 565, w: 190, h: 24, color: "blue", text: "2026年6月14日" },
  subtotal: { x: 1280, y: 1040, w: 205, h: 28, color: "orange", text: "MYR 1,484.77" },
  total: { x: 1348, y: 1060, w: 140, h: 24, color: "purple", text: "MYR 1,480.27" },
};

GlobalFonts.registerFromPath("/System/Library/Fonts/Hiragino Sans GB.ttc", "ReceiptZh");

const bg = await fs.readFile(".run/pdfjs-render-match.png");
const img = await loadImage(bg);
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);

for (const f of Object.values(FIELDS)) {
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = "#333333";
  ctx.font = "21px ReceiptZh, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(f.text, f.x + f.w - 4, f.y + f.h / 2);
}

await fs.writeFile(".run/receipt-debug-boxes.png", canvas.toBuffer("image/png"));
console.log("done");
