/**
 * Owner fortune ops: reply in feedback chat, regenerate daily for a date.
 * Usage:
 *   npx tsx scripts/fortune-ops.ts chat "你的消息"
 *   npx tsx scripts/fortune-ops.ts daily 2026-06-19
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
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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
  const [cmd, arg1, ...rest] = process.argv.slice(2);
  const message = rest.length ? rest.join(" ") : arg1;

  if (cmd === "chat") {
    const text =
      message ||
      "今天特别忙特别累，一大堆问题没处理完。你今天算的到底准不准？把分析逐条对照我说的事实，错的怎么改？明天19号要不一样的分析。";
    const { sendFeedbackChatMessage } = await import("../src/lib/fortune/feedback-chat.ts");
    const { readUserFortuneDataExport } = await import("../src/lib/fortune/user-store.ts");
    const data = await readUserFortuneDataExport(OWNER_ID);
    const reading =
      data.readings.find((r) => r.topic === "daily" && r.fortune_date === "2026-06-18") ??
      data.readings.find((r) => r.topic === "daily" && r.fortune_date);
    if (!reading) throw new Error("No daily reading found");
    const result = await sendFeedbackChatMessage({
      userId: OWNER_ID,
      reading,
      message: text,
      locale: "zh",
    });
    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }
    console.log(result.reply);
    return;
  }

  if (cmd === "daily") {
    const dateKey = arg1?.match(/^\d{4}-\d{2}-\d{2}$/) ? arg1 : undefined;
    if (dateKey) process.env.FORTUNE_DATE_OVERRIDE = dateKey;
    const { handleFortuneGenerate } = await import("../src/lib/fortune/generate-handler");
    const { getFortuneTodayKey } = await import("../src/lib/fortune/date");
    const today = getFortuneTodayKey();
    console.log(`Generating daily for ${today}…`);
    const result = await handleFortuneGenerate({
      userId: OWNER_ID,
      role: "owner",
      body: { topic: "daily", locale: "zh", force: true },
      skipQuota: true,
    });
    delete process.env.FORTUNE_DATE_OVERRIDE;
    if (result.status !== 200 || !("reading" in result.body)) {
      console.error(result);
      process.exit(1);
    }
    const r = result.body.reading;
    console.log("Title:", r.title);
    console.log("Summary:", r.summary);
    console.log(r.reading.slice(0, 1000));
    return;
  }

  console.log("Usage: fortune-ops.ts chat [message] | daily YYYY-MM-DD");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
