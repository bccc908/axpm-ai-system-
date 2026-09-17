/**
 * Generate a fresh ETH plan for Groktagon / KETT (no Telegram required).
 *   npx tsx scripts/eth-plan-now.ts
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const Module = require("module") as typeof import("module");
const orig = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return orig.apply(this, arguments as never);
} as typeof Module.prototype.require;

const envPath = path.join(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const key = t.slice(0, i).trim();
  const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

async function main() {
  const { fetchHlEthQuote } = await import("../src/lib/hyperliquid/price.ts");
  const { generateEthSignal } = await import("../src/lib/eth-signals/signal-engine.ts");
  const quote = await fetchHlEthQuote();
  const mark = quote?.price ?? null;
  console.log("HL ETH mark:", mark);
  const result = await generateEthSignal({
    locale: "zh",
    timeframe: "M15–H1",
    includeNews: true,
    spotOverride: mark ?? undefined,
    notes:
      "给 Groktagon KETT 用：Hyperliquid ETH-PERP。入场区必须贴近当前标记价。没把握就 wait。单笔名义约 12 美元。",
  });
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  const s = result.signal;
  console.log(s.bias, s.confidence + "%", s.strength);
  console.log("entry", s.entry_zone, "sl", s.stop_loss, "tp", s.take_profit);
  console.log("expires", s.expires_at);
  console.log(s.thesis.slice(0, 280));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
