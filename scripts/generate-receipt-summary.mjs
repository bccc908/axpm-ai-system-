#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { generateReceiptSummaryPdf, receiptSummaryDownloadName } from "../src/lib/finance/receipt-pdf-generate.ts";

async function main() {
  const raw = await fs.readFile("data/personal-finance.json", "utf-8");
  const data = JSON.parse(raw);
  const receipt = data.receipts?.[0];
  if (!receipt) {
    console.error("No receipt found");
    process.exit(1);
  }

  const pdf = await generateReceiptSummaryPdf(receipt);
  const name = receiptSummaryDownloadName(receipt);
  const downloads = path.join(process.env.HOME ?? "", "Downloads", name);
  const desktop = path.join(process.env.HOME ?? "", "Desktop", name);

  await fs.writeFile(downloads, pdf);
  await fs.writeFile(desktop, pdf).catch(() => undefined);

  console.log("Saved:", downloads);
  console.log("Saved:", desktop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
