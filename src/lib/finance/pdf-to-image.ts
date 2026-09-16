import "server-only";
import path from "path";

type RenderOptions = {
  scale?: number;
  quality?: number;
  /** Render page to this pixel width (overrides scale). */
  targetWidth?: number;
};

async function renderPdfFirstPage(
  buffer: Buffer,
  options?: RenderOptions,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const { createCanvas } = await import("@napi-rs/canvas");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(buffer);
    const standardFontDataUrl = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, standardFontDataUrl }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale =
      options?.targetWidth != null
        ? options.targetWidth / base.width
        : (options?.scale ?? 1.25);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    return { buffer: canvas.toBuffer("image/png"), width: viewport.width, height: viewport.height };
  } catch (error) {
    console.warn("[pdf-to-image]", error);
    return null;
  }
}

/** Render first PDF page to JPEG for vision OCR (scanned resit). */
export async function pdfFirstPageToJpeg(
  buffer: Buffer,
  options?: RenderOptions,
): Promise<{ buffer: Buffer; mimeType: "image/jpeg" } | null> {
  const quality = options?.quality ?? 0.88;
  const rendered = await renderPdfFirstPage(buffer, options);
  if (!rendered) return null;
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(rendered.buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return { buffer: canvas.toBuffer("image/jpeg", quality), mimeType: "image/jpeg" };
  } catch (error) {
    console.warn("[pdf-to-image]", error);
    return null;
  }
}

/** Render first PDF page to PNG at an exact pixel width (for receipt overlay). */
export async function pdfFirstPageToPng(
  buffer: Buffer,
  options?: { targetWidth?: number; scale?: number },
): Promise<Buffer | null> {
  const rendered = await renderPdfFirstPage(buffer, options);
  return rendered?.buffer ?? null;
}
