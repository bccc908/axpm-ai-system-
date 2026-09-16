import fs from "fs";
import { pdfFirstPageToJpeg } from "../src/lib/finance/pdf-to-image";

const buf = fs.readFileSync("data/receipts/d95dae2f-b9fb-4ce2-8abd-dfb3755b98b2.pdf");
const jpg = await pdfFirstPageToJpeg(buf, 2);
fs.writeFileSync(".run/receipt-original.jpg", jpg);
console.log("saved .run/receipt-original.jpg", jpg.length);
