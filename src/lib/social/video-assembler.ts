import "server-only";

import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { slideTimingsForCount } from "@/lib/social/video-spec";
import {
  SLIDE_MOTION,
  VIDEO_ENCODE,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "@/lib/social/video-quality";

const execFileAsync = promisify(execFile);

function getFfmpegPath(): string {
  return ffmpegInstaller.path;
}

export async function renderSlideClip(
  ffmpeg: string,
  slidePath: string,
  clipPath: string,
  durationSec: number,
  options?: { hook?: boolean },
) {
  const frames = Math.round(durationSec * VIDEO_FPS);
  const zoomStep = options?.hook ? SLIDE_MOTION.hookZoomStep : SLIDE_MOTION.pointZoomStep;
  const maxZoom = options?.hook ? SLIDE_MOTION.hookMaxZoom : SLIDE_MOTION.pointMaxZoom;
  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-loop",
      "1",
      "-i",
      slidePath,
      "-vf",
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},zoompan=z='min(zoom+${zoomStep},${maxZoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS},format=yuv420p`,
      "-t",
      String(durationSec),
      "-c:v",
      "libx264",
      "-preset",
      VIDEO_ENCODE.preset,
      "-crf",
      options?.hook ? VIDEO_ENCODE.crfHook : VIDEO_ENCODE.crf,
      "-pix_fmt",
      "yuv420p",
      "-an",
      clipPath,
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
}

export async function assembleSlideshowVideo(params: {
  exportDir: string;
  slideFiles: string[];
  secondsPerSlide?: number[];
  outputName?: string;
}) {
  const ffmpeg = getFfmpegPath();
  const outputName = params.outputName ?? "video.mp4";
  const outputPath = path.join(params.exportDir, outputName);
  const durations =
    params.secondsPerSlide ??
    slideTimingsForCount(params.slideFiles.length);

  const clipPaths: string[] = [];
  for (let i = 0; i < params.slideFiles.length; i++) {
    const clipPath = path.join(params.exportDir, `clip-${String(i + 1).padStart(2, "0")}.mp4`);
    await renderSlideClip(ffmpeg, params.slideFiles[i], clipPath, durations[i] ?? 4, {
      hook: i === 0,
    });
    clipPaths.push(clipPath);
  }

  const listPath = path.join(params.exportDir, "concat-v.txt");
  await fs.writeFile(
    listPath,
    clipPaths.map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join("\n"),
  );

  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  await Promise.all([
    fs.unlink(listPath).catch(() => undefined),
    ...clipPaths.map((p) => fs.unlink(p).catch(() => undefined)),
  ]);

  return { path: outputPath, name: outputName, urlPath: outputName };
}
