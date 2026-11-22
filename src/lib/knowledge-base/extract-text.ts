import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { fileExtension } from "@/lib/knowledge-base/file-types";

const MAX_CHARS = 80_000;

function clip(text: string) {
  const trimmed = text.replace(/\u0000/g, "").trim();
  if (trimmed.length <= MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_CHARS - 40).trimEnd()}\n\n[Text truncated.]`;
}

/** Local text only. Images stay attached; this never sends a file to an AI provider. */
export async function extractKnowledgeText(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string | null> {
  const ext = fileExtension(fileName);
  if (ext === ".md" || ext === ".markdown" || ext === ".txt" || mimeType.startsWith("text/")) {
    const text = clip(buffer.toString("utf8"));
    return text || null;
  }
  if (
    ext === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = clip(result.value);
      return text || null;
    } catch (error) {
      console.error("[knowledge-base] docx extract", error);
      return null;
    }
  }
  if (ext === ".doc" || mimeType === "application/msword") {
    const tmp = path.join(os.tmpdir(), `axpm-kb-${randomUUID()}.doc`);
    try {
      const WordExtractor = (await import("word-extractor")).default;
      await fs.writeFile(tmp, buffer);
      const doc = await new WordExtractor().extract(tmp);
      const text = clip([doc.getBody(), doc.getHeaders(), doc.getFootnotes()].filter(Boolean).join("\n\n"));
      return text || null;
    } catch (error) {
      console.error("[knowledge-base] doc extract", error);
      return null;
    } finally {
      await fs.unlink(tmp).catch(() => undefined);
    }
  }
  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        const text = clip(result.text ?? "");
        return text || null;
      } finally {
        await parser.destroy();
      }
    } catch (error) {
      console.error("[knowledge-base] pdf extract", error);
      return null;
    }
  }
  return null;
}
