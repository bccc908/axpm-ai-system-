import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "data", "groktagon-autopilot.json");

export const AUTOPILOT_INTERVAL_MS = 12 * 60_000;
export const DEFAULT_TRADE_PROMPT = `优先做 Hyperliquid ETH 永续，其次才是 BTC。没有把握就 wait，不要追价。
信心至少 70%，现价必须还在入场区内才开仓。
单笔名义最多约 12 美元（约 0.005 ETH 或 0.00015 BTC），必须带止损和止盈。
不要加仓、不要提高杠杆。已有仓位就交给止损/止盈，不要反手。`;

export type GroktagonAutopilot = {
  enabled: boolean;
  prompt: string;
  last_run_at: string | null;
  last_result: string | null;
  last_fired: boolean;
  updated_at: string;
};

function empty(): GroktagonAutopilot {
  return {
    enabled: false,
    prompt: DEFAULT_TRADE_PROMPT,
    last_run_at: null,
    last_result: null,
    last_fired: false,
    updated_at: new Date().toISOString(),
  };
}

export async function getGroktagonAutopilot(): Promise<GroktagonAutopilot> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<GroktagonAutopilot>;
    return {
      enabled: Boolean(parsed.enabled),
      prompt: typeof parsed.prompt === "string" && parsed.prompt.trim() ? parsed.prompt : DEFAULT_TRADE_PROMPT,
      last_run_at: parsed.last_run_at ?? null,
      last_result: parsed.last_result ?? null,
      last_fired: Boolean(parsed.last_fired),
      updated_at: parsed.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return empty();
  }
}

export async function saveGroktagonAutopilot(
  patch: Partial<GroktagonAutopilot>,
): Promise<GroktagonAutopilot> {
  const current = await getGroktagonAutopilot();
  const next: GroktagonAutopilot = {
    ...current,
    ...patch,
    prompt:
      typeof patch.prompt === "string"
        ? patch.prompt.trim() || DEFAULT_TRADE_PROMPT
        : current.prompt,
    updated_at: new Date().toISOString(),
  };
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(next, null, 2));
  return next;
}
