import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { getTtsEngineOrder, type TtsEngineId } from "@/lib/local/self-hosted-config";
import { getPresenterSettings } from "@/lib/social/presenter-settings";
import { isMiniMaxConfigured, synthesizeMiniMaxMp3 } from "@/lib/social/minimax-tts";
import { synthesizePiperWav } from "@/lib/social/piper-tts";
import { EdgeTTS } from "edge-tts-universal";

async function edgeToWav(text: string, wavPath: string, voice: string) {
  const tmpMp3 = `${wavPath}.edge.mp3`;
  const tts = new EdgeTTS(text.trim(), voice, { rate: "+8%" });
  const result = await tts.synthesize();
  const buffer = Buffer.from(await result.audio.arrayBuffer());
  if (buffer.length < 512) throw new Error("Edge TTS empty response");
  await fs.writeFile(tmpMp3, buffer);
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  try {
    await promisify(execFile)(ffmpegInstaller.default.path, ["-y", "-i", tmpMp3, wavPath]);
  } finally {
    await fs.unlink(tmpMp3).catch(() => undefined);
  }
}

async function macToWav(text: string, wavPath: string, voice: string) {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  const aiff = `${wavPath}.aiff`;
  await execFileAsync("say", ["-v", voice, "-o", aiff, text.trim()], {
    env: { ...process.env, PATH: `/usr/bin:/bin:${process.env.PATH ?? ""}` },
  });
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  await execFileAsync(ffmpegInstaller.default.path, ["-y", "-i", aiff, wavPath]);
  await fs.unlink(aiff).catch(() => undefined);
}

async function miniMaxToWav(text: string, wavPath: string) {
  const mp3 = `${wavPath}.mp3`;
  await synthesizeMiniMaxMp3(text, mp3);
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  await promisify(execFile)(ffmpegInstaller.default.path, ["-y", "-i", mp3, wavPath]);
  await fs.unlink(mp3).catch(() => undefined);
}

export async function synthesizeLocalSpeech(params: {
  text: string;
  engine?: TtsEngineId | "auto";
  edgeVoice?: string;
  macVoice?: string;
}): Promise<{ wavPath: string; engine: TtsEngineId; workDir: string }> {
  const settings = await getPresenterSettings();
  const priority =
    params.engine && params.engine !== "auto"
      ? params.engine
      : settings.ttsPriority;
  const order = getTtsEngineOrder(priority);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axpm-tts-"));
  const wavPath = path.join(workDir, "speech.wav");
  const macVoice = params.macVoice ?? settings.macVoice;
  const edgeVoice = params.edgeVoice ?? settings.edgeVoice;

  for (const engine of order) {
    if (engine === "minimax" && !isMiniMaxConfigured()) continue;
    try {
      if (engine === "piper") await synthesizePiperWav(params.text, wavPath);
      else if (engine === "minimax") await miniMaxToWav(params.text, wavPath);
      else if (engine === "mac") await macToWav(params.text, wavPath, macVoice);
      else if (engine === "edge") await edgeToWav(params.text, wavPath, edgeVoice);
      return { wavPath, engine, workDir };
    } catch (error) {
      console.warn(`[Local TTS] ${engine} failed:`, error);
      await fs.unlink(wavPath).catch(() => undefined);
    }
  }

  await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  throw new Error("All TTS engines failed — run: bash scripts/install-piper.sh");
}

export async function cleanupLocalSpeech(workDir: string) {
  await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
}
