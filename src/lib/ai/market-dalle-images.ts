import "server-only";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getOpenAI, openAiErrorMessage } from "@/lib/ai/client";
import { isOpenAIReachable } from "@/lib/ai/openai-reachable";
import { slideSvg, type DeckOutline, type DeckSlide } from "@/lib/ai/market-generate";

const MAX_DALLE_SLIDES = 6;

export function isDalleConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function slidePrompt(
  slide: DeckSlide,
  deckTitle: string,
  index: number,
  total: number,
  editNote?: string,
) {
  const bullets = slide.bullets.slice(0, 3).join("; ");
  let prompt =
    `Professional 16:9 marketing presentation slide background for a fintech/forex business deck. ` +
    `Slide ${index + 1}/${total}. Theme: ${deckTitle}. Headline concept: ${slide.title}. ` +
    `Key points: ${bullets}. Dark navy gradient, subtle gold accent, modern clean layout, ` +
    `no watermark, no logo, minimal abstract shapes. Leave center area readable for text overlay.`;
  if (editNote?.trim()) {
    prompt += ` Apply this edit from the user: ${editNote.trim().slice(0, 500)}`;
  }
  return prompt;
}

async function generateDalleImage(prompt: string): Promise<Buffer | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const reachable = await isOpenAIReachable();
  if (!reachable) return null;

  try {
    const response = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || "dall-e-3",
      prompt: prompt.slice(0, 3800),
      size: "1792x1024",
      quality: "standard",
      n: 1,
    });

    const url = response.data?.[0]?.url;
    if (!url) return null;

    const imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch (error) {
    console.warn("[DALL-E slide]", openAiErrorMessage(error));
    return null;
  }
}

function overlaySvg(slide: DeckSlide, index: number, total: number, deckTitle: string) {
  const titleLines = slide.title.slice(0, 40);
  const bullets = slide.bullets.slice(0, 4);
  const bulletSvg = bullets
    .map(
      (b, i) =>
        `<text x="120" y="${420 + i * 52}" fill="#e2e8f0" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="32">• ${escapeXml(b.slice(0, 36))}</text>`,
    )
    .join("");

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="rgba(15,23,42,0.55)"/>
  <text x="120" y="200" fill="#ffffff" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="56" font-weight="800">${escapeXml(titleLines)}</text>
  ${bulletSvg}
  <text x="120" y="980" fill="#94a3b8" font-family="PingFang SC, sans-serif" font-size="24">${escapeXml(deckTitle)} · ${index + 1}/${total}</text>
</svg>`);
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildSingleSlideImage(
  outline: DeckOutline,
  slideIndex: number,
  outputDir: string,
  editNote?: string,
): Promise<{ filename: string; usedDalle: boolean }> {
  await fs.mkdir(outputDir, { recursive: true });
  const total = outline.slides.length;
  if (slideIndex < 0 || slideIndex >= total) {
    throw new Error("Invalid slide index");
  }

  const filename = `slide-${String(slideIndex + 1).padStart(2, "0")}.png`;
  const outPath = path.join(outputDir, filename);
  const slide = outline.slides[slideIndex];

  let background: Buffer | null = null;
  let usedDalle = false;
  if (slideIndex < MAX_DALLE_SLIDES && isDalleConfigured()) {
    background = await generateDalleImage(
      slidePrompt(slide, outline.deckTitle, slideIndex, total, editNote),
    );
    if (background) usedDalle = true;
  }

  if (background) {
    const overlay = overlaySvg(slide, slideIndex, total, outline.deckTitle);
    await sharp(background)
      .resize(1920, 1080, { fit: "cover" })
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png()
      .toFile(outPath);
  } else {
    const svg = slideSvg(slide, slideIndex, total, outline.deckTitle);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
  }

  return { filename, usedDalle };
}

export async function buildDalleSlideImages(
  outline: DeckOutline,
  outputDir: string,
): Promise<{ files: string[]; usedDalle: boolean }> {
  await fs.mkdir(outputDir, { recursive: true });
  const names: string[] = [];
  let usedDalle = false;

  for (let i = 0; i < outline.slides.length; i++) {
    const { filename, usedDalle: slideUsedDalle } = await buildSingleSlideImage(
      outline,
      i,
      outputDir,
    );
    names.push(filename);
    if (slideUsedDalle) usedDalle = true;
  }

  return { files: names, usedDalle };
}
