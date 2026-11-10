import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type BridgeName = "mt5" | "atas" | "bookmap";

const DEFAULT_DIR = path.join(process.cwd(), "data");

let chain: Promise<void> = Promise.resolve();

/** Test helper: resolves after queued poll writes finish. */
export function whenBridgePollsSettled() {
  return chain;
}

/** Remember a successful chart-bridge poll. Failures are swallowed; no secrets are stored. */
export function recordBridgePoll(name: BridgeName, ok = true, dataDir = DEFAULT_DIR) {
  const file = path.join(dataDir, "bridge-polls.json");
  chain = chain
    .then(async () => {
      await mkdir(dataDir, { recursive: true });
      let current: Record<string, { at: string; ok: boolean }> = {};
      try {
        const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed as Record<string, { at: string; ok: boolean }>;
        }
      } catch {
        current = {};
      }
      current[name] = { at: new Date().toISOString(), ok };
      await writeFile(file, JSON.stringify(current, null, 2));
    })
    .catch(() => undefined);
}
