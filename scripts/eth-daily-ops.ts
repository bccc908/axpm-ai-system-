/**
 * Run daily ETH signal now (Telegram). Same logic as cron /api/eth-signals/daily
 * Usage:
 *   npx tsx scripts/eth-daily-ops.ts
 *   npx tsx scripts/eth-daily-ops.ts --force
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
  const force = process.argv.includes("--force");
  const { runDailyEthSignal } = await import("../src/lib/eth-signals/daily.ts");

  console.log(force ? "Sending daily ETH signal (force)…" : "Sending daily ETH signal…");
  const result = await runDailyEthSignal({ force });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.skipped) {
    console.log("Skipped:", result.reason, "| today:", result.today);
    if (result.reason === "already_sent") {
      console.log("Use --force to send again today");
    }
    return;
  }

  if ("partial" in result && result.partial) {
    console.error("Signal generated but Telegram failed:", result.telegram.error);
    process.exit(1);
  }

  console.log("Sent ✓", result.today);
  if (result.signal) {
    console.log(result.signal.bias, result.signal.confidence + "%");
    console.log(result.signal.thesis?.slice(0, 200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
