import "server-only";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import type { FinanceReceipt } from "@/types/finance";
import { pdfFirstPageToPng } from "@/lib/finance/pdf-to-image";
import { detectTripComFields, type TripComFieldKey } from "@/lib/finance/receipt-pdf-detect";
import { RECEIPTS_DIR } from "@/lib/finance/store";
import { buildReceiptDownloadName } from "@/lib/finance/receipt-files";

const BASE = { w: 1600, h: 1369 } as const;

type Field = { x: number; y: number; w: number; h: number };

let fontReady = false;

function ensureFont() {
  if (fontReady) return;
  for (const p of [
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  ]) {
    try {
      GlobalFonts.registerFromPath(p, "ReceiptZh");
      fontReady = true;
      return;
    } catch {
      // next
    }
  }
  fontReady = true;
}

function parseDateRange(notes?: string | null): { checkIn: string; checkOut: string } | null {
  if (!notes) return null;
  const m = notes.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d1, mo1, y1, d2, mo2, y2] = m;
  return {
    checkIn: `${y1}年${Number(mo1)}月${Number(d1)}日`,
    checkOut: `${y2}年${Number(mo2)}月${Number(d2)}日`,
  };
}

function formatMyr(amount: number): string {
  return `MYR${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function renderEditedReceiptImage(
  background: Buffer,
  edits: Record<TripComFieldKey, string>,
  fields: Record<TripComFieldKey, Field>,
): Promise<Buffer> {
  ensureFont();
  const img = await loadImage(background);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

  function patchBg(f: Field): string {
    const points: Array<[number, number]> = [
      [f.x - 10, f.y + Math.floor(f.h / 2)],
      [f.x + f.w + 10, f.y + Math.floor(f.h / 2)],
      [f.x + 8, f.y + 3],
      [f.x + 8, f.y + f.h - 3],
    ];
    let best = { lum: -1, r: 255, g: 255, b: 255 };
    for (const [cx, cy] of points) {
      if (cx < 0 || cy < 0 || cx >= img.width || cy >= img.height) continue;
      const i = (cy * img.width + cx) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum > best.lum) best = { lum, r, g, b };
    }
    return `rgb(${best.r},${best.g},${best.b})`;
  }

  function patch(f: Field, headerField = false) {
    ctx.fillStyle = headerField ? "#ffffff" : patchBg(f);
    for (let n = 0; n < 3; n++) ctx.fillRect(f.x, f.y, f.w, f.h);
  }

  function drawLeft(text: string, f: Field) {
    ctx.fillStyle = "#222222";
    const size = Math.max(16, Math.round(img.width * 0.0115));
    ctx.font = `${size}px ReceiptZh, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, f.x + 4, f.y + f.h / 2);
  }

  function drawRight(text: string, f: Field, bold = false) {
    ctx.fillStyle = "#222222";
    const size = Math.max(16, Math.round(img.width * 0.0115));
    ctx.font = `${bold ? "600 " : ""}${size}px ReceiptZh, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const rightX = Math.min(f.x + f.w - 6, img.width - 12);
    ctx.fillText(text, rightX, f.y + f.h / 2);
  }

  for (const key of Object.keys(fields) as TripComFieldKey[]) {
    patch(fields[key], key === "paymentDate");
  }
  if (fields.paymentDate) drawLeft(edits.paymentDate, fields.paymentDate);
  drawRight(edits.checkIn, fields.checkIn);
  drawRight(edits.checkOut, fields.checkOut);
  drawRight(edits.subtotal, fields.subtotal, true);
  drawRight(edits.total, fields.total, true);

  return canvas.toBuffer("image/png");
}

export async function generateEditedReceiptPdf(receipt: FinanceReceipt): Promise<Uint8Array> {
  const filePath = path.join(RECEIPTS_DIR, receipt.filename);
  const original = await fs.readFile(filePath);
  const rendered = await pdfFirstPageToPng(original, { targetWidth: BASE.w });
  if (!rendered) throw new Error("Failed to render original receipt");

  const img = await loadImage(rendered);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

  const fields = detectTripComFields(data, width, height);
  if (!fields?.checkIn || !fields.checkOut || !fields.subtotal || !fields.total) {
    throw new Error("Could not detect Trip.com receipt fields");
  }

  const range = parseDateRange(receipt.notes);
  const checkIn = range?.checkIn ?? "";
  const checkOut = range?.checkOut ?? checkIn;
  const total = receipt.amount ?? 0;

  const editedImage = await renderEditedReceiptImage(
    rendered,
    {
      paymentDate: checkIn,
      checkIn,
      checkOut,
      subtotal: formatMyr(total + 4.5),
      total: formatMyr(total),
    },
    fields as Record<TripComFieldKey, Field>,
  );

  const edited = await loadImage(editedImage);
  const pageWidth = 595.28;
  const pageHeight = (edited.height / edited.width) * pageWidth;
  const doc = await PDFDocument.create();
  const page = doc.addPage([pageWidth, pageHeight]);
  const embedded = await doc.embedPng(editedImage);
  page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  return doc.save();
}

export function editedReceiptDownloadName(receipt: FinanceReceipt): string {
  return buildReceiptDownloadName(receipt);
}
