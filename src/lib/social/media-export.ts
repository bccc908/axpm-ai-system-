import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { SlideCardCopy } from "@/lib/ai/social-copy-prompt";
import { hasPresenterPhoto } from "@/lib/social/presenter-avatar";
import { assemblePresenterVideo } from "@/lib/social/presenter-video";
import { renderSlidesToDir } from "@/lib/social/slide-renderer";
import { assembleSlideshowVideo } from "@/lib/social/video-assembler";

const EXPORT_ROOT = path.join(process.cwd(), "data", "social-media", "exports");

export type MediaExportResult = {
  exportId: string;
  slides: { name: string; url: string }[];
  video?: { name: string; url: string };
  width: number;
  height: number;
  mode: "presenter" | "slides";
  videoWarning?: string;
  speechSource?: "edge" | "mac" | "silent";
};

function fileUrl(exportId: string, filename: string) {
  return `/api/social/media/file/${exportId}/${encodeURIComponent(filename)}`;
}

export async function generateSocialMediaPack(params: {
  title: string;
  script: string;
  slideCards?: SlideCardCopy[];
  narrationsZh?: string[];
  includeVideo: boolean;
  mode?: "presenter" | "slides" | "auto";
}) {
  const exportId = randomUUID().slice(0, 12);
  const exportDir = path.join(EXPORT_ROOT, exportId);
  await fs.mkdir(exportDir, { recursive: true });

  const usePresenter =
    params.mode === "presenter" ||
    (params.mode !== "slides" && (params.mode === "auto" || !params.mode) && (await hasPresenterPhoto()));

  let slides: MediaExportResult["slides"] = [];
  let video: MediaExportResult["video"];
  let mode: MediaExportResult["mode"] = "slides";
  let videoWarning: string | undefined;
  let speechSource: MediaExportResult["speechSource"];

  if (usePresenter && params.includeVideo) {
    mode = "presenter";
    try {
      const vid = await assemblePresenterVideo({
        exportDir,
        title: params.title.trim() || "干货分享",
        script: params.script.trim(),
        slideCards: params.slideCards,
        narrationsZh: params.narrationsZh,
      });
      video = { name: vid.name, url: fileUrl(exportId, vid.name) };
      slides = vid.slides.map((s) => ({
        name: s.name,
        url: fileUrl(exportId, s.name),
      }));
      speechSource = vid.speechSource;
      if (vid.warning) videoWarning = vid.warning;
    } catch (error) {
      console.error("[Presenter Video]", error);
      const rendered = await renderSlidesToDir({
        exportDir,
        title: params.title.trim() || "干货分享",
        script: params.script.trim(),
        slideCards: params.slideCards,
      });
      slides = rendered.slides.map((s) => ({
        name: s.name,
        url: fileUrl(exportId, s.name),
      }));
      mode = "slides";
      videoWarning =
        error instanceof Error
          ? `真人讲解失败（${error.message}），已改生成 AI 幻灯片`
          : "真人讲解失败，已改生成 AI 幻灯片";

      if (rendered.slides.length > 0) {
        try {
          const vid = await assembleSlideshowVideo({
            exportDir,
            slideFiles: rendered.slides.map((s) => s.path),
          });
          video = { name: vid.name, url: fileUrl(exportId, vid.name) };
        } catch (slideVideoError) {
          console.error("[Social Video fallback]", slideVideoError);
        }
      }
    }
  } else {
    const rendered = await renderSlidesToDir({
      exportDir,
      title: params.title.trim() || "干货分享",
      script: params.script.trim(),
      slideCards: params.slideCards,
    });
    slides = rendered.slides.map((s) => ({
      name: s.name,
      url: fileUrl(exportId, s.name),
    }));

    if (params.includeVideo && rendered.slides.length > 0) {
      try {
        const vid = await assembleSlideshowVideo({
          exportDir,
          slideFiles: rendered.slides.map((s) => s.path),
        });
        video = { name: vid.name, url: fileUrl(exportId, vid.name) };
      } catch (error) {
        console.error("[Social Video]", error);
      }
    }
  }

  await fs.writeFile(
    path.join(exportDir, "manifest.json"),
    JSON.stringify(
      {
        exportId,
        title: params.title,
        mode,
        createdAt: new Date().toISOString(),
        slides: slides.map((s) => s.name),
        video: video?.name ?? null,
      },
      null,
      2,
    ),
  );

  return {
    exportId,
    slides,
    video,
    width: 1080,
    height: 1920,
    mode,
    videoWarning,
    speechSource,
  } satisfies MediaExportResult;
}

export function resolveExportFile(exportId: string, filename: string) {
  const safeId = exportId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeName = path.basename(filename);
  const filePath = path.join(EXPORT_ROOT, safeId, safeName);
  if (!filePath.startsWith(path.join(EXPORT_ROOT, safeId))) {
    throw new Error("Invalid path");
  }
  return filePath;
}
