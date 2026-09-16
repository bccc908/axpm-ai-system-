import "server-only";

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { isHlAddress, normalizeHlAddress } from "@/lib/hyperliquid/client";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export async function getHyperliquidAddress(): Promise<string | null> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as { hyperliquidAddress?: unknown };
    if (typeof parsed.hyperliquidAddress === "string" && isHlAddress(parsed.hyperliquidAddress)) {
      return normalizeHlAddress(parsed.hyperliquidAddress);
    }
  } catch {
    /* fall through */
  }
  const env = process.env.HYPERLIQUID_ADDRESS?.trim() ?? "";
  return isHlAddress(env) ? normalizeHlAddress(env) : null;
}

export async function saveHyperliquidAddress(address: string | null): Promise<string | null> {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await readFile(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
  } catch {
    current = {};
  }
  const next = address && isHlAddress(address) ? normalizeHlAddress(address) : null;
  current.hyperliquidAddress = next;
  await writeFile(SETTINGS_FILE, JSON.stringify(current, null, 2), "utf8");
  return next;
}
