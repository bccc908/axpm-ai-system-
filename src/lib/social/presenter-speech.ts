import "server-only";

import { execFile, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { EdgeTTS } from "edge-tts-universal";
import type { SlideNarration } from "@/lib/social/presenter-narration";
import { isMiniMaxConfigured, synthesizeMiniMaxMp3 } from "@/lib/social/minimax-tts";
import { synthesizePiperWav } from "@/lib/social/piper-tts";
import { getTtsEngineOrder, type TtsEngineId } from "@/lib/local/self-hosted-config";
import { getPresenterSettings } from "@/lib/social/presenter-settings";
import { MAC_VOICES } from "@/lib/social/presenter-voices";
import { VIDEO_ENCODE } from "@/lib/social/video-quality";
import { VIDEO_TARGET_SECONDS } from "@/lib/social/video-spec";

const execFileAsync = promisify(execFile);
const ffmpeg = () => ffmpegInstaller.path;
const MAC_VOICE_IDS = MAC_VOICES.map((v) => v.id);
const EDGE_RETRIES = 5;

/** Next.js production often has a minimal PATH — macOS `say` lives in /usr/bin */
const EXEC_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`,
};

export type SpeechSource = "piper" | "minimax" | "edge" | "mac" | "silent";

export type PresenterSpeechResult = {
  audioPath?: string;
  duration: number;
  source: SpeechSource;
  warning?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probeDuration(mediaPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg(), ["-i", mediaPath, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
      env: EXEC_ENV,
    });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", () => {
      const match = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) {
        reject(new Error(`Cannot read audio duration: ${path.basename(mediaPath)}`));
        return;
      }
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = parseFloat(match[3]);
      resolve(Math.max(0, h * 3600 + m * 60 + s));
    });
  });
}

async function validateAudio(mediaPath: string, minSec = 0.3): Promise<number> {
  const stat = await fs.stat(mediaPath);
  if (stat.size < 512) throw new Error(`Audio too small (${stat.size} bytes)`);
  const dur = await probeDuration(mediaPath);
  if (dur < minSec) throw new Error(`Audio too short (${dur.toFixed(2)}s)`);
  return dur;
}

async function runFfmpeg(args: string[]) {
  await execFileAsync(ffmpeg(), args, {
    maxBuffer: 16 * 1024 * 1024,
    env: EXEC_ENV,
  });
}

async function anyToWav(inputPath: string, wavPath: string) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-ac",
    "2",
    "-ar",
    "44100",
    "-c:a",
    "pcm_s16le",
    wavPath,
  ]);
  await validateAudio(wavPath, 0.2);
}

async function wavToMp3(wavPath: string, mp3Path: string) {
  await runFfmpeg([
    "-y",
    "-i",
    wavPath,
    "-ac",
    "2",
    "-ar",
    "44100",
    "-c:a",
    "libmp3lame",
    "-b:a",
    VIDEO_ENCODE.audioBitrate,
    mp3Path,
  ]);
}

async function fitWavToDuration(inputWav: string, outputWav: string, targetSec: number) {
  const actual = await validateAudio(inputWav, 0.2);
  const filters: string[] = [];

  if (actual > targetSec + 0.08) {
    let ratio = actual / targetSec;
    while (ratio > 2.0) {
      filters.push("atempo=2.0");
      ratio /= 2.0;
    }
    if (ratio > 1.03) filters.push(`atempo=${ratio.toFixed(4)}`);
  } else if (actual < targetSec - 0.08) {
    filters.push(`apad=pad_dur=${(targetSec - actual).toFixed(3)}`);
  }

  const args = ["-y", "-i", inputWav];
  if (filters.length) args.push("-af", filters.join(","));
  args.push("-t", String(targetSec), "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", outputWav);
  await runFfmpeg(args);
  await validateAudio(outputWav, Math.min(0.4, targetSec * 0.2));
}

async function edgeToWav(text: string, wavPath: string, voice: string) {
  const tmpMp3 = `${wavPath}.edge.mp3`;
  const tts = new EdgeTTS(text, voice, { rate: "+8%" });
  const result = await tts.synthesize();
  const buffer = Buffer.from(await result.audio.arrayBuffer());
  if (buffer.length < 512) throw new Error("Edge TTS empty response");
  await fs.writeFile(tmpMp3, buffer);
  try {
    await anyToWav(tmpMp3, wavPath);
  } finally {
    await fs.unlink(tmpMp3).catch(() => undefined);
  }
}

async function macToWav(
  text: string,
  wavPath: string,
  workDir: string,
  voices: string[],
) {
  const trimmed = text.trim().slice(0, 800);
  const textPath = path.join(workDir, `say-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.txt`);
  await fs.writeFile(textPath, trimmed, "utf-8");

  let lastError: unknown;
  try {
    for (const voice of voices) {
      const aiff = `${wavPath}.${voice}.aiff`;
      try {
        await fs.unlink(aiff).catch(() => undefined);
        await execFileAsync(
          "/usr/bin/say",
          ["-v", voice, "-r", "168", "-o", aiff, "-f", textPath],
          { env: EXEC_ENV, maxBuffer: 4 * 1024 * 1024 },
        );
        await anyToWav(aiff, wavPath);
        await fs.unlink(aiff).catch(() => undefined);
        return;
      } catch (error) {
        lastError = error;
        await fs.unlink(aiff).catch(() => undefined);
        console.warn(`[Presenter TTS] Mac voice "${voice}" failed:`, error);
      }
    }
  } finally {
    await fs.unlink(textPath).catch(() => undefined);
  }
  throw lastError ?? new Error("Mac TTS failed");
}

async function miniMaxToWav(text: string, wavPath: string) {
  const tmpMp3 = `${wavPath}.minimax.mp3`;
  await synthesizeMiniMaxMp3(text, tmpMp3);
  try {
    await anyToWav(tmpMp3, wavPath);
  } finally {
    await fs.unlink(tmpMp3).catch(() => undefined);
  }
}

async function piperToWav(text: string, wavPath: string) {
  await synthesizePiperWav(text, wavPath);
}

async function runEngine(
  engine: TtsEngineId,
  text: string,
  wavPath: string,
  workDir: string,
  macVoices: string[],
  edgeVoice: string,
): Promise<void> {
  switch (engine) {
    case "piper":
      await piperToWav(text, wavPath);
      return;
    case "minimax":
      await miniMaxToWav(text, wavPath);
      return;
    case "mac":
      await macToWav(text, wavPath, workDir, macVoices);
      return;
    case "edge":
      await edgeToWav(text, wavPath, edgeVoice);
      return;
    default:
      throw new Error(`Unknown TTS engine: ${engine}`);
  }
}

async function synthesizeTextToWav(
  text: string,
  wavPath: string,
  workDir: string,
): Promise<SpeechSource> {
  const settings = await getPresenterSettings();
  const macVoices = [
    settings.macVoice,
    ...MAC_VOICE_IDS.filter((v) => v !== settings.macVoice),
  ];
  const order = getTtsEngineOrder(settings.ttsPriority);
  const hasMiniMax = isMiniMaxConfigured();

  for (const engine of order) {
    if (engine === "minimax" && !hasMiniMax) continue;

    try {
      await runEngine(engine, text, wavPath, workDir, macVoices, settings.edgeVoice);
      return engine;
    } catch (error) {
      console.warn(`[Presenter TTS] ${engine} failed, trying next:`, error);
      await fs.unlink(wavPath).catch(() => undefined);
    }
  }

  if (process.platform === "darwin") {
    for (let i = 0; i < EDGE_RETRIES; i++) {
      try {
        await edgeToWav(text, wavPath, settings.edgeVoice);
        return "edge";
      } catch (error) {
        console.warn(`[Presenter TTS] Edge fallback ${i + 1}/${EDGE_RETRIES}:`, error);
        await fs.unlink(wavPath).catch(() => undefined);
        if (i < EDGE_RETRIES - 1) await sleep(600 * (i + 1));
      }
    }
  }

  throw new Error("No TTS engine available — install Piper or check network for Edge TTS");
}

async function concatWavs(parts: string[], outputWav: string) {
  if (parts.length === 1) {
    await fs.copyFile(parts[0], outputWav);
    return;
  }
  const listPath = `${outputWav}.txt`;
  await fs.writeFile(
    listPath,
    parts.map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join("\n"),
  );
  try {
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputWav]);
  } catch {
    const inputs = parts.flatMap((p) => ["-i", p]);
    const filter =
      parts.map((_, i) => `[${i}:a]`).join("") + `concat=n=${parts.length}:v=0:a=1[aout]`;
    await runFfmpeg([
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[aout]",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-c:a",
      "pcm_s16le",
      outputWav,
    ]);
  }
  await fs.unlink(listPath).catch(() => undefined);
  await validateAudio(outputWav, 1);
}

/** Primary: one full narration — most natural speech, fewest failure points */
async function synthesizeFullTrack(
  segments: SlideNarration[],
  outputPath: string,
  workDir: string,
): Promise<PresenterSpeechResult> {
  const fullText = segments.map((s) => s.text.trim()).filter(Boolean).join("。");
  const rawWav = path.join(workDir, "voice-full-raw.wav");
  const fitWav = path.join(workDir, "voice-full-fit.wav");

  const source = await synthesizeTextToWav(fullText, rawWav, workDir);
  await fitWavToDuration(rawWav, fitWav, VIDEO_TARGET_SECONDS);
  await wavToMp3(fitWav, outputPath);
  await validateAudio(outputPath, VIDEO_TARGET_SECONDS - 10);

  await fs.unlink(rawWav).catch(() => undefined);
  await fs.unlink(fitWav).catch(() => undefined);

  return {
    audioPath: outputPath,
    duration: VIDEO_TARGET_SECONDS,
    source,
    warning:
      source === "piper"
        ? "已用 Piper 本地配音（自托管）"
        : source === "minimax"
          ? "已用 MiniMax AI 配音"
          : source === "mac"
            ? "已改用 Mac 中文配音"
            : source === "edge"
              ? "已用 Edge 在线配音"
              : undefined,
  };
}

/** Fallback: per-slide WAV segments then concat */
async function synthesizeSegmentTrack(
  segments: SlideNarration[],
  outputPath: string,
  workDir: string,
): Promise<PresenterSpeechResult> {
  const fitted: string[] = [];
  let source: SpeechSource = "edge";
  let piperUsed = false;
  let minimaxUsed = false;
  let macUsed = false;

  for (let i = 0; i < segments.length; i++) {
    const raw = path.join(workDir, `voice-seg-${i}-raw.wav`);
    const fit = path.join(workDir, `voice-seg-${i}.wav`);
    const segSource = await synthesizeTextToWav(segments[i].text, raw, workDir);
    if (segSource === "piper") piperUsed = true;
    if (segSource === "minimax") minimaxUsed = true;
    if (segSource === "mac") macUsed = true;
    await fitWavToDuration(raw, fit, segments[i].seconds);
    fitted.push(fit);
    await fs.unlink(raw).catch(() => undefined);
  }

  if (piperUsed) source = "piper";
  else if (minimaxUsed) source = "minimax";
  else if (macUsed) source = "mac";

  const mergedWav = path.join(workDir, "voice-merged.wav");
  await concatWavs(fitted, mergedWav);
  await fitWavToDuration(mergedWav, path.join(workDir, "voice-final.wav"), VIDEO_TARGET_SECONDS);
  await wavToMp3(path.join(workDir, "voice-final.wav"), outputPath);
  await validateAudio(outputPath, VIDEO_TARGET_SECONDS - 10);

  await Promise.all([
    ...fitted.map((p) => fs.unlink(p).catch(() => undefined)),
    fs.unlink(mergedWav).catch(() => undefined),
    fs.unlink(path.join(workDir, "voice-final.wav")).catch(() => undefined),
  ]);

  return {
    audioPath: outputPath,
    duration: VIDEO_TARGET_SECONDS,
    source,
    warning: piperUsed
      ? "已用 Piper 本地配音（分段模式）"
      : minimaxUsed
        ? "已用 MiniMax AI 配音（分段模式）"
        : macUsed
          ? "已用 Mac 中文配音（分段模式）"
          : undefined,
  };
}

export async function synthesizeSegmentedPresenterSpeech(
  segments: SlideNarration[],
  outputPath: string,
  workDir: string,
): Promise<PresenterSpeechResult> {
  try {
    return await synthesizeFullTrack(segments, outputPath, workDir);
  } catch (fullError) {
    console.warn("[Presenter TTS] Full-track failed, trying segments:", fullError);
  }

  try {
    return await synthesizeSegmentTrack(segments, outputPath, workDir);
  } catch (segError) {
    console.error("[Presenter TTS] All synthesis failed:", segError);
    await fs.unlink(outputPath).catch(() => undefined);
  }

  if (process.platform === "darwin") {
    throw new Error("配音生成失败 — 请确认系统有中文语音（系统设置 → 辅助功能 → 朗读内容）");
  }

  return {
    duration: VIDEO_TARGET_SECONDS,
    source: "silent",
    warning: "配音失败 — 请检查网络后重试",
  };
}
