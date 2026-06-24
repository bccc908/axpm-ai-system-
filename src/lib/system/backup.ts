import "server-only";

import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

/** JSON files included in full system backup (relative to data/) */
export const BACKUP_JSON_FILES = [
  "crm.json",
  "conversations.json",
  "inbox-sessions.json",
  "settings.json",
  "personal-assistant.json",
  "fortune.json",
  "personal-finance.json",
  "social-posts.json",
  "email-log.json",
  "reply-agent-knowledge.json",
  "market-knowledge.json",
  "market-diary.json",
  "market-chat.json",
  "users.json",
  "customer-accounts.json",
  "widget-config.json",
] as const;

export type BackupFileMeta = {
  name: string;
  exists: boolean;
  bytes: number;
  updated_at: string | null;
};

export type SystemBackupBundle = {
  version: 1;
  app: "axpm-ai-system";
  created_at?: string;
  files: Record<string, unknown>;
};

async function discoverDynamicBackupPaths(): Promise<string[]> {
  const paths: string[] = [];
  const dirs = ["user-fortune", "fortune-public-shares"] as const;

  for (const dir of dirs) {
    const fullDir = path.join(DATA_DIR, dir);
    try {
      const files = await fs.readdir(fullDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          paths.push(`${dir}/${file}`);
        }
      }
    } catch {
      /* directory may not exist */
    }
  }

  return paths.sort();
}

export async function getAllBackupRelativePaths(): Promise<string[]> {
  const dynamic = await discoverDynamicBackupPaths();
  const staticSet = new Set<string>(BACKUP_JSON_FILES);
  const merged: string[] = [...BACKUP_JSON_FILES];
  for (const p of dynamic) {
    if (!staticSet.has(p)) merged.push(p);
  }
  return merged;
}

export async function listBackupFileMeta(): Promise<BackupFileMeta[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const rows: BackupFileMeta[] = [];

  for (const name of await getAllBackupRelativePaths()) {
    const filePath = path.join(DATA_DIR, name);
    try {
      const stat = await fs.stat(filePath);
      rows.push({
        name,
        exists: true,
        bytes: stat.size,
        updated_at: stat.mtime.toISOString(),
      });
    } catch {
      rows.push({ name, exists: false, bytes: 0, updated_at: null });
    }
  }

  return rows;
}

async function readBackupFile(relativePath: string): Promise<unknown | undefined> {
  if (relativePath.includes("..")) return undefined;
  const filePath = path.join(DATA_DIR, relativePath);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export async function createSystemBackup(): Promise<SystemBackupBundle> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files: Record<string, unknown> = {};

  for (const name of await getAllBackupRelativePaths()) {
    const payload = await readBackupFile(name);
    if (payload !== undefined) {
      files[name] = payload;
    }
  }

  const createdAt = new Date().toISOString();
  const bundle: SystemBackupBundle = {
    version: 1,
    app: "axpm-ai-system",
    created_at: createdAt,
    files,
  };

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = createdAt.replace(/[:.]/g, "-");
  await fs.writeFile(
    path.join(BACKUP_DIR, `backup-${stamp}.json`),
    JSON.stringify(bundle, null, 2),
  );

  // Prune old local backups (keep last 14)
  try {
    const backups = (await fs.readdir(BACKUP_DIR))
      .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
      .sort()
      .reverse();
    for (const old of backups.slice(14)) {
      await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }

  return bundle;
}

export async function restoreSystemBackup(
  bundle: SystemBackupBundle,
  options?: { createPreRestoreBackup?: boolean },
) {
  if (bundle.version !== 1 || bundle.app !== "axpm-ai-system") {
    throw new Error("Invalid backup format");
  }
  if (!bundle.files || typeof bundle.files !== "object") {
    throw new Error("Backup has no files");
  }

  if (options?.createPreRestoreBackup !== false) {
    await createSystemBackup();
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const restored: string[] = [];

  for (const [name, payload] of Object.entries(bundle.files)) {
    if (payload === undefined || name.includes("..")) continue;
    const filePath = path.join(DATA_DIR, name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
    restored.push(name);
  }

  return { restored, count: restored.length };
}

export function parseBackupUpload(raw: string): SystemBackupBundle {
  const parsed = JSON.parse(raw) as SystemBackupBundle;
  if (parsed.version !== 1 || parsed.app !== "axpm-ai-system") {
    throw new Error("Unsupported backup file");
  }
  return parsed;
}
