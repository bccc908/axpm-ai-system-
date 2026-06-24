import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import {
  buildSlideImages,
  generateDeckOutline,
  type DeckOutline,
  type DeckSlide,
} from "@/lib/ai/market-generate";
import {
  marketOutputDir,
  marketOutputFileUrl,
  registerMarketOutput,
  updateMarketOutputFiles,
} from "@/lib/ai/market-outputs";
import { isMarketForceLocal } from "@/lib/local/self-hosted-config";

const PREVIEW_ROOT = path.join(process.cwd(), "data", "market-previews");

type PreviewMeta = {
  topic: string;
  title: string;
  provider: "dalle" | "svg";
  created_at: string;
  files: string[];
};

export function marketPreviewDir(id: string) {
  return path.join(PREVIEW_ROOT, id);
}

export function marketPreviewFileUrl(previewId: string, filename: string) {
  return `/api/ai/market-advisor/preview/${previewId}/${encodeURIComponent(filename)}`;
}

export function marketPreviewFilePath(previewId: string, filename: string) {
  return path.join(marketPreviewDir(previewId), path.basename(filename));
}

async function readPreviewOutline(previewId: string): Promise<DeckOutline> {
  const raw = await fs.readFile(path.join(marketPreviewDir(previewId), "outline.json"), "utf-8");
  return JSON.parse(raw) as DeckOutline;
}

async function writePreviewOutline(previewId: string, outline: DeckOutline) {
  await fs.writeFile(
    path.join(marketPreviewDir(previewId), "outline.json"),
    JSON.stringify(outline, null, 2),
  );
}

async function readPreviewMeta(previewId: string): Promise<PreviewMeta> {
  const raw = await fs.readFile(path.join(marketPreviewDir(previewId), "meta.json"), "utf-8");
  return JSON.parse(raw) as PreviewMeta;
}

async function writePreviewMeta(previewId: string, meta: PreviewMeta) {
  await fs.writeFile(path.join(marketPreviewDir(previewId), "meta.json"), JSON.stringify(meta, null, 2));
}

async function buildPreviewSlides(
  outline: DeckOutline,
  dir: string,
): Promise<{ files: string[]; provider: PreviewMeta["provider"] }> {
  const { buildSingleSlideImage, isDalleConfigured } = await import(
    "@/lib/ai/market-dalle-images"
  );

  if (!isMarketForceLocal() && isDalleConfigured()) {
    const files: string[] = [];
    let usedDalle = false;
    for (let i = 0; i < outline.slides.length; i++) {
      const { filename, usedDalle: slideUsedDalle } = await buildSingleSlideImage(
        outline,
        i,
        dir,
      );
      files.push(filename);
      if (slideUsedDalle) usedDalle = true;
    }
    return { files, provider: usedDalle ? "dalle" : "svg" };
  }

  const files = await buildSlideImages(outline, dir);
  return { files, provider: "svg" };
}

async function applySlideEdit(slide: DeckSlide, editNote: string): Promise<DeckSlide> {
  const result = await deepSeekChat({
    messages: [
      {
        role: "system",
        content:
          "Update a presentation slide based on the user's edit request. Return JSON only: { \"title\": string, \"bullets\": string[] }. Keep the same language as the slide.",
      },
      {
        role: "user",
        content: `Current slide:\n${JSON.stringify(slide, null, 2)}\n\nEdit request:\n${editNote.trim()}`,
      },
    ],
    json: true,
    temperature: 0.4,
  });

  if (!result.ok) return slide;

  try {
    const parsed = JSON.parse(result.content) as { title?: string; bullets?: string[] };
    return {
      title: String(parsed.title ?? slide.title).trim() || slide.title,
      bullets: Array.isArray(parsed.bullets)
        ? parsed.bullets.map(String).filter(Boolean).slice(0, 6)
        : slide.bullets,
      speakerNotes: slide.speakerNotes,
    };
  } catch {
    return slide;
  }
}

export async function createMarketImagePreview(topic: string, context?: string) {
  const outline = await generateDeckOutline(topic, context);
  const previewId = randomUUID().slice(0, 12);
  const dir = marketPreviewDir(previewId);
  await fs.mkdir(dir, { recursive: true });

  const { files, provider } = await buildPreviewSlides(outline, dir);
  await writePreviewOutline(previewId, outline);
  await writePreviewMeta(previewId, {
    topic: topic.trim(),
    title: outline.deckTitle,
    provider,
    created_at: new Date().toISOString(),
    files,
  });

  return {
    previewId,
    title: outline.deckTitle,
    outline,
    provider,
    images: files.map((name) => ({
      name,
      url: marketPreviewFileUrl(previewId, name),
    })),
    slideCount: outline.slides.length,
  };
}

export async function regenerateMarketPreviewSlide(
  previewId: string,
  slideIndex: number,
  editNote?: string,
) {
  const dir = marketPreviewDir(previewId);
  try {
    await fs.access(dir);
  } catch {
    throw new Error("Preview not found");
  }

  const outline = await readPreviewOutline(previewId);
  if (slideIndex < 0 || slideIndex >= outline.slides.length) {
    throw new Error("Invalid slide index");
  }

  if (editNote?.trim()) {
    outline.slides[slideIndex] = await applySlideEdit(outline.slides[slideIndex], editNote);
    await writePreviewOutline(previewId, outline);
  }

  const { buildSingleSlideImage, isDalleConfigured } = await import(
    "@/lib/ai/market-dalle-images"
  );

  let provider: PreviewMeta["provider"] = "svg";
  if (!isMarketForceLocal() && isDalleConfigured()) {
    const { filename, usedDalle } = await buildSingleSlideImage(
      outline,
      slideIndex,
      dir,
      editNote,
    );
    provider = usedDalle ? "dalle" : "svg";
    const meta = await readPreviewMeta(previewId);
    meta.provider = provider;
    await writePreviewMeta(previewId, meta);
    return {
      slideIndex,
      slide: outline.slides[slideIndex],
      image: {
        name: filename,
        url: `${marketPreviewFileUrl(previewId, filename)}?v=${Date.now()}`,
      },
    };
  }

  const { filename } = await buildSingleSlideImage(outline, slideIndex, dir, editNote);
  return {
    slideIndex,
    slide: outline.slides[slideIndex],
    image: {
      name: filename,
      url: `${marketPreviewFileUrl(previewId, filename)}?v=${Date.now()}`,
    },
  };
}

export async function confirmMarketImagePreview(previewId: string) {
  const dir = marketPreviewDir(previewId);
  try {
    await fs.access(dir);
  } catch {
    throw new Error("Preview not found");
  }

  const meta = await readPreviewMeta(previewId);
  const entry = await registerMarketOutput({
    kind: "image",
    title: meta.title,
  });
  const outDir = marketOutputDir(entry.id);

  const files: string[] = [];
  for (const name of meta.files) {
    const src = path.join(dir, name);
    const dest = path.join(outDir, name);
    await fs.copyFile(src, dest);
    files.push(name);
  }

  await updateMarketOutputFiles(entry.id, files);
  await fs.rm(dir, { recursive: true, force: true });

  return {
    outputId: entry.id,
    title: meta.title,
    images: files.map((name) => ({
      name,
      url: marketOutputFileUrl(entry.id, name),
    })),
    slideCount: files.length,
    provider: meta.provider,
  };
}

export async function discardMarketImagePreview(previewId: string) {
  await fs.rm(marketPreviewDir(previewId), { recursive: true, force: true }).catch(() => undefined);
}
