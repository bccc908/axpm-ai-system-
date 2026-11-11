import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Static imports so Vite can resolve them (a template-string import() is not analysable).
const loaders = {
  gold: () => import("@/lib/gold-signals/automation"),
  btc: () => import("@/lib/btc-signals/automation"),
  eth: () => import("@/lib/eth-signals/automation"),
  hl: () => import("@/lib/hl-signals/automation"),
  xau: () => import("@/lib/xau-signals/automation"),
} as const;

describe("daily automation defaults OFF when the automation file is missing", () => {
  afterEach(() => vi.restoreAllMocks());
  for (const engine of ["gold", "btc", "eth", "hl", "xau"] as const) {
    it(engine, async () => {
      vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(path.join(tmpdir(), "auto-")));
      process.env.TELEGRAM_BOT_TOKEN = "t";
      process.env.TELEGRAM_CHAT_ID = "1";
      delete process.env[`${engine.toUpperCase()}_DAILY_TELEGRAM`];
      vi.resetModules();
      const mod = await loaders[engine]();
      const getter = Object.values(mod).find(
        (f) => typeof f === "function" && /^get\w+SignalAutomation$/.test((f as { name: string }).name),
      ) as () => Promise<{ daily_telegram_enabled: boolean }>;
      expect((await getter()).daily_telegram_enabled).toBe(false);
    });
  }
});
