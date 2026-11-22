import fs from "fs/promises";
import path from "path";
import { parseDriveFolderId } from "@/lib/knowledge-base/links";

export type KnowledgeDriveFolder = {
  id: string;
  url: string;
  label: string;
};

export function getKnowledgeDriveFile() {
  return (
    process.env.AXPM_KNOWLEDGE_DRIVE_FILE?.trim() ||
    path.join(process.cwd(), "data", "knowledge-drive.json")
  );
}

export async function readKnowledgeDriveFolder(): Promise<KnowledgeDriveFolder | null> {
  try {
    const raw = await fs.readFile(getKnowledgeDriveFile(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<KnowledgeDriveFolder>;
    const id = typeof parsed.id === "string" ? parseDriveFolderId(parsed.id) : null;
    if (!id) return null;
    const url =
      typeof parsed.url === "string" && parsed.url.startsWith("https://")
        ? parsed.url
        : `https://drive.google.com/drive/folders/${id}`;
    const label =
      typeof parsed.label === "string" && parsed.label.trim()
        ? parsed.label.trim().slice(0, 80)
        : "Staff library";
    return { id, url, label };
  } catch {
    return null;
  }
}

export async function saveKnowledgeDriveFolder(
  input: string,
  label?: string,
): Promise<{ ok: true; folder: KnowledgeDriveFolder } | { ok: false }> {
  const id = parseDriveFolderId(input);
  if (!id) return { ok: false };
  const folder: KnowledgeDriveFolder = {
    id,
    url: input.trim().startsWith("https://") ? input.trim() : `https://drive.google.com/drive/folders/${id}`,
    label: label?.trim().slice(0, 80) || "Staff library",
  };
  const file = getKnowledgeDriveFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(folder, null, 2));
  return { ok: true, folder };
}

export async function clearKnowledgeDriveFolder() {
  await fs.rm(getKnowledgeDriveFile(), { force: true });
}
