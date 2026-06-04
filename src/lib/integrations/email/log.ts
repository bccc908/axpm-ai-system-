import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { EmailLogEntry } from "@/types/email";

const LOG_FILE = path.join(process.cwd(), "data", "email-log.json");
const MAX_ENTRIES = 100;

async function readLog(): Promise<EmailLogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, "utf-8");
    return JSON.parse(raw) as EmailLogEntry[];
  } catch {
    return [];
  }
}

export async function appendEmailLog(
  entry: Omit<EmailLogEntry, "id" | "sentAt">,
): Promise<EmailLogEntry> {
  const log = await readLog();
  const row: EmailLogEntry = {
    ...entry,
    id: randomUUID(),
    sentAt: new Date().toISOString(),
  };
  log.unshift(row);
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.writeFile(LOG_FILE, JSON.stringify(log.slice(0, MAX_ENTRIES), null, 2));
  return row;
}

export async function listEmailLog(limit = 20) {
  const log = await readLog();
  return log.slice(0, limit);
}
