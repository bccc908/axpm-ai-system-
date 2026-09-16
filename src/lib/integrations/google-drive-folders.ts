import "server-only";

import fs from "fs/promises";
import path from "path";

export type DriveExcelFolder = {
  id: string;
  label: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "google-drive-excel-folders.json");

function parseFolderUrlOrId(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const urlMatch = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) return text;
  return null;
}

function parseEnvFolders(): DriveExcelFolder[] {
  const out: DriveExcelFolder[] = [];

  const jsonRaw = process.env.GOOGLE_DRIVE_EXCEL_FOLDERS?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") {
            const id = parseFolderUrlOrId(item);
            if (id) out.push({ id, label: id.slice(0, 8) });
          } else if (item && typeof item === "object") {
            const row = item as { id?: string; label?: string };
            const id = parseFolderUrlOrId(row.id ?? "");
            if (id) {
              out.push({ id, label: (row.label ?? id.slice(0, 8)).trim() || id.slice(0, 8) });
            }
          }
        }
      }
    } catch {
      /* ignore bad JSON */
    }
  }

  const idsRaw = process.env.GOOGLE_DRIVE_EXCEL_FOLDER_IDS?.trim();
  if (idsRaw) {
    for (const part of idsRaw.split(/[,;\n]/)) {
      const id = parseFolderUrlOrId(part);
      if (id) out.push({ id, label: id.slice(0, 8) });
    }
  }

  const single = process.env.GOOGLE_DRIVE_EXCEL_FOLDER_ID?.trim();
  if (single) {
    const id = parseFolderUrlOrId(single);
    if (id) out.push({ id, label: "默认" });
  }

  return out;
}

async function readStoredFolders(): Promise<DriveExcelFolder[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw) as { folders?: DriveExcelFolder[] };
    return (data.folders ?? []).filter((f) => f.id && f.label);
  } catch {
    return [];
  }
}

async function writeStoredFolders(folders: DriveExcelFolder[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify({ folders }, null, 2));
}

export function dedupeFolders(folders: DriveExcelFolder[]): DriveExcelFolder[] {
  const map = new Map<string, DriveExcelFolder>();
  for (const f of folders) {
    const id = parseFolderUrlOrId(f.id);
    if (!id) continue;
    map.set(id, { id, label: f.label.trim() || id.slice(0, 8) });
  }
  return [...map.values()];
}

/** Merged list: saved folders first, then env (deduped). */
export async function getExcelDriveFolders(): Promise<DriveExcelFolder[]> {
  const stored = await readStoredFolders();
  const fromEnv = parseEnvFolders();
  return dedupeFolders([...stored, ...fromEnv]);
}

export async function addExcelDriveFolder(
  input: string,
  label?: string,
): Promise<{ ok: true; folders: DriveExcelFolder[] } | { ok: false; error: string }> {
  const id = parseFolderUrlOrId(input);
  if (!id) return { ok: false, error: "Invalid folder ID or URL" };

  const stored = await readStoredFolders();
  const next = dedupeFolders([
    ...stored,
    { id, label: (label?.trim() || id.slice(0, 8)) },
  ]);
  await writeStoredFolders(next);
  const all = await getExcelDriveFolders();
  return { ok: true, folders: all };
}

export async function removeExcelDriveFolder(
  folderId: string,
): Promise<{ ok: true; folders: DriveExcelFolder[] } | { ok: false; error: string }> {
  const id = parseFolderUrlOrId(folderId);
  if (!id) return { ok: false, error: "Invalid folder ID" };

  const stored = await readStoredFolders();
  const next = stored.filter((f) => f.id !== id);
  await writeStoredFolders(next);
  const all = await getExcelDriveFolders();
  return { ok: true, folders: all };
}

export { parseFolderUrlOrId };
