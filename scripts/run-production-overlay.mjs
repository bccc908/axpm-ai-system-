import fs from "fs/promises";
import path from "path";
import { generateEditedReceiptPdf } from "../src/lib/finance/receipt-pdf-overlay.ts";

const receipt = {
  id: "020d05e6-9b0b-4e9b-8030-5865595bcc02",
  filename: "d95dae2f-b9fb-4ce2-8abd-dfb3755b98b2.pdf",
  merchant: "Trip.com",
  amount: 1480.27,
  receipt_date: "2026-06-14",
  notes: "1/6/2026 - 14/6/2026 · 全季酒店 济南西站东广场店",
};

const pdf = await generateEditedReceiptPdf(receipt);
const out = path.join(process.env.HOME ?? "", "Downloads", "Trip-com_MYR1480.27_FIXED.pdf");
await fs.writeFile(out, pdf);
await fs.writeFile(path.join(process.env.HOME ?? "", "Desktop", "Trip-com_MYR1480.27_FIXED.pdf"), pdf);
console.log("Production overlay saved", out, pdf.length, "bytes");
