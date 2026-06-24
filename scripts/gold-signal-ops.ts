/**
 * Gold signal ops — generate XAUUSD signal + Telegram push.
 * Usage:
 *   npx tsx scripts/gold-signal-ops.ts
 *   npx tsx scripts/gold-signal-ops.ts "H1 上方卖墙，等回踩"
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
  const notes = process.argv.slice(2).join(" ").trim() || undefined;
  const { generateGoldSignal } = await import("../src/lib/gold-signals/signal-engine.ts");
  const { sendGoldSignalTelegram } = await import("../src/lib/gold-signals/telegram.ts");
  const { toAtasAlert } = await import("../src/lib/gold-signals/store.ts");

  console.log("Generating XAUUSD signal…");
  const result = await generateGoldSignal({
    locale: "zh",
    timeframe: "M15–H1",
    notes,
    includeNews: true,
  });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  const tg = await sendGoldSignalTelegram(result.signal);
  const atas = toAtasAlert(result.signal);

  console.log("\n--- Signal ---");
  console.log(result.signal.thesis);
  console.log("\nBias:", result.signal.bias, "| Confidence:", result.signal.confidence + "%");
  if (result.signal.entry_zone) {
    console.log(
      "Entry:",
      result.signal.entry_zone.low.toFixed(2),
      "–",
      result.signal.entry_zone.high.toFixed(2),
    );
  }
  if (result.signal.stop_loss) console.log("Stop:", result.signal.stop_loss.toFixed(2));
  if (result.signal.take_profit.length) {
    console.log("Targets:", result.signal.take_profit.map((p) => p.toFixed(2)).join(" / "));
  }

  console.log("\n--- ATAS levels ---");
  for (const level of atas.levels) {
    console.log(`  ${level.label}: ${level.price}`);
  }

  console.log("\nTelegram:", tg.ok ? "sent ✓" : `failed — ${tg.error}`);
  console.log("\nATAS API: GET /api/gold-signals/atas (Bearer LOCAL_API_KEY)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
