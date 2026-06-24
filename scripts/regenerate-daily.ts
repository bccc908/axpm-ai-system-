/**
 * Regenerate today's daily fortune for the owner account (force).
 * Usage: npx tsx scripts/regenerate-daily.ts
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

// Load .env.local before server modules
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

const OWNER_ID = "db249a97-4d81-4945-a751-35732c8cafbf";

async function main() {
  const { getFortuneTodayKey } = await import("../src/lib/fortune/date");
  const { handleFortuneGenerate } = await import("../src/lib/fortune/generate-handler");
  const { readUserFortuneDataExport, writeUserFortuneDataFull } = await import(
    "../src/lib/fortune/user-store"
  );

  const today = getFortuneTodayKey();
  console.log(`Regenerating daily fortune for ${today}…`);

  const data = await readUserFortuneDataExport(OWNER_ID);
  const oldId = data.readings.find(
    (r) => r.topic === "daily" && r.fortune_date === today && !r.question?.trim(),
  )?.id;

  const result = await handleFortuneGenerate({
    userId: OWNER_ID,
    role: "owner",
    body: { topic: "daily", locale: "zh", force: true },
    skipQuota: true,
  });

  if (result.status !== 200 || !("reading" in result.body)) {
    console.error("Failed:", result);
    process.exit(1);
  }

  const reading = result.body.reading;
  console.log("\n✅ New reading:");
  console.log("Title:", reading.title);
  console.log("Summary:", reading.summary);
  console.log("ID:", reading.id);

  if (oldId && oldId !== reading.id) {
    const fresh = await readUserFortuneDataExport(OWNER_ID);
    if (fresh.feedback_chats?.[oldId]) {
      delete fresh.feedback_chats[oldId];
      await writeUserFortuneDataFull(OWNER_ID, fresh);
      console.log("Cleared old feedback chat for", oldId);
    }
  }

  console.log("\n--- Preview (first 1200 chars) ---\n");
  console.log(reading.reading.slice(0, 1200));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
