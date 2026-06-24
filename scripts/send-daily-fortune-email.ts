/**
 * Send today's daily fortune email (force).
 * Usage: npx tsx scripts/send-daily-fortune-email.ts
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
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* optional */
}

async function main() {
  const { runDailyFortuneEmail } = await import("../src/lib/fortune/daily");
  const result = await runDailyFortuneEmail({ force: true });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
