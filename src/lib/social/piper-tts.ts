import "server-only";

import { execFile, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type PiperConfig = {
  bin: string;
  model: string;
  config?: string;
};

const DEFAULT_PIPER_DIR = path.join(process.cwd(), "data", "piper");

export function getPiperConfig(): PiperConfig | null {
  const bin =
    process.env.PIPER_BIN?.trim() ||
    path.join(DEFAULT_PIPER_DIR, "piper");
  const model =
    process.env.PIPER_MODEL?.trim() ||
    path.join(DEFAULT_PIPER_DIR, "zh_CN-huayan-medium.onnx");

  if (!bin || !model) return null;
  return {
    bin,
    model,
    config: process.env.PIPER_MODEL_CONFIG?.trim() || model.replace(/\.onnx$/, ".onnx.json"),
  };
}

export async function isPiperConfigured(): Promise<boolean> {
  const config = getPiperConfig();
  if (!config) return false;
  try {
    await fs.access(config.bin);
    await fs.access(config.model);
    return true;
  } catch {
    return false;
  }
}

/** Sync check for config paths only (startup / env UI). */
export function isPiperConfiguredSync(): boolean {
  return Boolean(getPiperConfig());
}

export async function synthesizePiperWav(text: string, outputPath: string): Promise<void> {
  const config = getPiperConfig();
  if (!config) throw new Error("Piper not configured — run: bash scripts/install-piper.sh");

  const trimmed = text.trim().slice(0, 5000);
  if (trimmed.length < 1) throw new Error("Piper TTS text too short");

  try {
    await fs.access(config.bin);
    await fs.access(config.model);
  } catch {
    throw new Error(
      "Piper binary or model missing — run: bash scripts/install-piper.sh",
    );
  }

  const args = ["--model", config.model, "--output_file", outputPath];
  if (config.config) {
    try {
      await fs.access(config.config);
      args.push("--config", config.config);
    } catch {
      /* optional config */
    }
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(config.bin, args, {
      stdio: ["pipe", "ignore", "pipe"],
      env: process.env,
    });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Piper failed (${code}): ${stderr.slice(0, 300)}`));
        return;
      }
      resolve();
    });
    proc.stdin.write(trimmed);
    proc.stdin.end();
  });

  const stat = await fs.stat(outputPath);
  if (stat.size < 512) {
    throw new Error("Piper produced empty audio");
  }
}

export async function getPiperVersion(): Promise<string | null> {
  const config = getPiperConfig();
  if (!config) return null;
  try {
    const { stdout } = await execFileAsync(config.bin, ["--version"], { timeout: 5000 });
    return stdout.trim().split("\n")[0] || "piper";
  } catch {
    return "piper";
  }
}
