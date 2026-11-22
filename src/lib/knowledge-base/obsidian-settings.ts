import fs from "fs/promises";
import path from "path";

export type ObsidianConnectionSettings = {
  vaultName: string;
  localPathLabel: string;
  /** Always false. AXPM never reads a vault folder on a staff computer. */
  readsLocalVault: false;
};

export function getObsidianSettingsFile() {
  return (
    process.env.AXPM_KNOWLEDGE_OBSIDIAN_FILE?.trim() ||
    path.join(process.cwd(), "data", "knowledge-obsidian.json")
  );
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function readObsidianSettings(): Promise<ObsidianConnectionSettings> {
  try {
    const raw = await fs.readFile(getObsidianSettingsFile(), "utf-8");
    const parsed = JSON.parse(raw) as { vaultName?: unknown; localPathLabel?: unknown };
    return {
      vaultName: clean(parsed.vaultName, 80),
      localPathLabel: clean(parsed.localPathLabel, 300),
      readsLocalVault: false,
    };
  } catch {
    return { vaultName: "", localPathLabel: "", readsLocalVault: false };
  }
}

export async function saveObsidianSettings(input: {
  vaultName?: unknown;
  localPathLabel?: unknown;
}): Promise<ObsidianConnectionSettings> {
  const settings: ObsidianConnectionSettings = {
    vaultName: clean(input.vaultName, 80),
    localPathLabel: clean(input.localPathLabel, 300),
    readsLocalVault: false,
  };
  const file = getObsidianSettingsFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(settings, null, 2));
  return settings;
}
