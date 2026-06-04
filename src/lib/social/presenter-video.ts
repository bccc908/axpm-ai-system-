import "server-only";

import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { SlideCardCopy } from "@/lib/ai/social-copy-prompt";
import { getAvatarPath } from "@/lib/social/presenter-avatar";
import {
  assertFullVideoCoverage,
  buildSlideNarrations,
} from "@/lib/social/presenter-narration";
import {
  synthesizeSegmentedPresenterSpeech,
  type SpeechSource,
} from "@/lib/social/presenter-speech";
import { renderPresenterSlidesToDir } from "@/lib/social/slide-renderer";
import { renderSlideClip } from "@/lib/social/video-assembler";
import {
  slideTimingsForCount,
  VIDEO_TARGET_SECONDS,
} from "@/lib/social/video-spec";
import { VIDEO_ENCODE } from "@/lib/social/video-quality";

const execFileAsync = promisify(execFile);

function srtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export async function buildSrtFromSegments(
  segments: { text: string; seconds: number }[],
  srtPath: string,
) {
  let cursor = 0;
  const blocks: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = cursor;
    const end = Math.min(VIDEO_TARGET_SECONDS, cursor + segments[i].seconds);
    blocks.push(`${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${segments[i].text}\n`);
    cursor = end;
  }
  await fs.writeFile(srtPath, blocks.join("\n"), "utf-8");
}

function escapeFfmpegPath(filePath: string) {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

async function concatVideoClips(ffmpeg: string, exportDir: string, clipPaths: string[]) {
  const listPath = path.join(exportDir, "presenter-concat.txt");
  const silentPath = path.join(exportDir, "presenter-visual.mp4");
  await fs.writeFile(
    listPath,
    clipPaths.map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join("\n"),
  );
  await execFileAsync(
    ffmpeg,
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", silentPath],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  await fs.unlink(listPath).catch(() => undefined);
  return silentPath;
}

export async function assemblePresenterVideo(params: {
  exportDir: string;
  title: string;
  script: string;
  photoPath?: string;
  slideCards?: SlideCardCopy[];
  narrationsZh?: string[];
}) {
  const ffmpeg = ffmpegInstaller.path;
  const photo = params.photoPath ?? getAvatarPath();
  const audioPath = path.join(params.exportDir, "voice.mp3");
  const srtPath = path.join(params.exportDir, "subs.srt");
  const outputPath = path.join(params.exportDir, "video.mp4");
  const duration = VIDEO_TARGET_SECONDS;

  const rendered = await renderPresenterSlidesToDir({
    exportDir: params.exportDir,
    title: params.title.trim() || "干货分享",
    script: params.script.trim(),
    photoPath: photo,
    slideCards: params.slideCards,
  });

  const narrations = buildSlideNarrations({
    script: params.script.trim(),
    slideCards: params.slideCards,
    narrationsZh: params.narrationsZh,
    slideCount: rendered.slides.length,
  });
  assertFullVideoCoverage(narrations);

  const speech = await synthesizeSegmentedPresenterSpeech(
    narrations,
    audioPath,
    params.exportDir,
  );
  if (!speech.audioPath) {
    throw new Error(speech.warning ?? "配音生成失败");
  }
  await buildSrtFromSegments(narrations, srtPath);

  const durations = slideTimingsForCount(rendered.slides.length);
  const clipPaths: string[] = [];
  for (let i = 0; i < rendered.slides.length; i++) {
    const clipPath = path.join(
      params.exportDir,
      `presenter-clip-${String(i + 1).padStart(2, "0")}.mp4`,
    );
    await renderSlideClip(
      ffmpeg,
      rendered.slides[i].path,
      clipPath,
      durations[i] ?? duration / rendered.slides.length,
      { hook: i === 0 },
    );
    clipPaths.push(clipPath);
  }

  const visualPath = await concatVideoClips(ffmpeg, params.exportDir, clipPaths);
  await Promise.all(clipPaths.map((p) => fs.unlink(p).catch(() => undefined)));

  const subFilter = `subtitles='${escapeFfmpegPath(srtPath)}':force_style='FontName=PingFang SC,FontSize=34,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=130,Bold=1'`;

  const ffmpegArgs = ["-y", "-i", visualPath, "-i", audioPath];

  ffmpegArgs.push(
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-vf",
    subFilter,
    "-c:v",
    "libx264",
    "-preset",
    VIDEO_ENCODE.preset,
    "-crf",
    VIDEO_ENCODE.crf,
    "-c:a",
    "aac",
    "-b:a",
    VIDEO_ENCODE.audioBitrate,
    "-pix_fmt",
    "yuv420p",
    "-t",
    String(duration),
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  );

  await execFileAsync(ffmpeg, ffmpegArgs, { maxBuffer: 30 * 1024 * 1024 });
  await fs.unlink(visualPath).catch(() => undefined);

  return {
    path: outputPath,
    name: "video.mp4",
    urlPath: "video.mp4",
    duration,
    speechSource: speech.source as SpeechSource,
    warning: speech.warning,
    slides: rendered.slides,
  };
}
