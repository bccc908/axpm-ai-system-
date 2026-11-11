import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const SIGNAL_DIRS = [
  "src/lib/gold-signals",
  "src/lib/btc-signals",
  "src/lib/eth-signals",
  "src/lib/hl-signals",
  "src/lib/xau-signals",
  "src/lib/gold-spread",
  "src/app/api/gold-signals",
  "src/app/api/btc-signals",
  "src/app/api/eth-signals",
  "src/app/api/hl-signals",
  "src/app/api/xau-signals",
  "src/app/api/gold-spread",
];
const SIGNAL_SCRIPTS = [
  "scripts/gold-signal-ops.ts",
  "scripts/gold-daily-ops.ts",
  "scripts/btc-daily-ops.ts",
  "scripts/eth-daily-ops.ts",
  "scripts/hl-daily-ops.ts",
  "scripts/xau-daily-ops.ts",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

const FORBIDDEN = [/sendTelegramMessage/, /telegramRequest/, /api\.telegram\.org/, /TELEGRAM_CHAT_ID/];

describe("signal code never talks to Telegram except through @/lib/signal-approval", () => {
  const files = [
    ...SIGNAL_DIRS.flatMap((d) => walk(path.join(ROOT, d))),
    ...SIGNAL_SCRIPTS.map((s) => path.join(ROOT, s)),
  ];
  it("scans the signal trees", () => expect(files.length).toBeGreaterThan(30));
  for (const file of files) {
    it(path.relative(ROOT, file), () => {
      const src = readFileSync(file, "utf8")
        // presence checks for the desk's "Telegram configured" badge are allowed
        .replace(/process\.env\.TELEGRAM_CHAT_ID\?\.trim\(\)/g, "");
      for (const re of FORBIDDEN) expect(src, `${re} in ${file}`).not.toMatch(re);
    });
  }
  it("the approval module sends exactly one kind of new message, to the approver chat", () => {
    const deliver = readFileSync(path.join(ROOT, "src/lib/signal-approval/deliver.ts"), "utf8");
    expect(deliver.match(/"sendMessage"/g)?.length).toBe(1);
    expect(deliver).toMatch(/chat_id: chatId,/);
    expect(deliver).toMatch(/chatId = assertApproverChat\(approver\)/);
    const callbacks = readFileSync(path.join(ROOT, "src/lib/signal-approval/callbacks.ts"), "utf8");
    expect(callbacks).not.toMatch(/"sendMessage"/);
  });
});
