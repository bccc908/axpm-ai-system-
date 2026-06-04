import "server-only";

import path from "path";
import type OpenAI from "openai";
import { getOpenAI, getChatModel, openAiErrorMessage } from "@/lib/ai/client";
import { isOpenAIReachable } from "@/lib/ai/openai-reachable";
import {
  isAllowedKnowledgeFilename,
  normalizeKnowledgeMimeType,
} from "@/lib/ai/agent-knowledge-shared";

const MAX_CHARS = 40_000;

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".xml",
  ".log",
]);

function truncate(text: string) {
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS)}\n\n[…truncated]`;
}

function isTextFile(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/");
}

function isImageFile(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  return (
    mimeType.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
  );
}

function isPdfFile(filename: string, mimeType: string) {
  return mimeType === "application/pdf" || path.extname(filename).toLowerCase() === ".pdf";
}

function isDocxFile(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  return (
    ext === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isRtfFile(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".rtf" || mimeType === "application/rtf" || mimeType === "text/rtf";
}

function isLegacyDocFile(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".doc" || mimeType === "application/msword";
}

/** Strip basic RTF control words for training text */
function extractRtfPlain(buffer: Buffer) {
  const raw = buffer.toString("utf-8");
  const stripped = raw
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) throw new Error("RTF file is empty");
  return truncate(stripped);
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) {
    throw new Error(
      "Word document has no readable text — try saving as .docx with content or export as .txt",
    );
  }
  return truncate(text);
}

async function extractPdfLocal(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return truncate(result.text.trim());
  } finally {
    await parser.destroy();
  }
}

async function extractWithOpenAI(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error(
      "AI API key required for scanned PDFs and images. Upload .txt, .md, or .docx instead, or set DEEPSEEK_API_KEY.",
    );
  }

  const reachable = await isOpenAIReachable();
  if (!reachable) {
    throw new Error(
      "Cannot reach OpenAI for PDF/image OCR. Upload .txt, .md, or .docx, or fix network to api.openai.com",
    );
  }

  const base64 = buffer.toString("base64");
  const prompt =
    "Extract ALL readable text from this document for training a customer service AI agent. " +
    "Preserve product names, prices, steps, FAQs, and policies. Output plain text only (no markdown fences). " +
    "If the document is in Chinese, keep Chinese. If bilingual, include both.";

  try {
    if (isImageFile(filename, mimeType)) {
      const response = await openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.2,
      });
      return truncate(response.choices[0]?.message?.content?.trim() ?? "");
    }

    if (isPdfFile(filename, mimeType)) {
      const pdfContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        { type: "text", text: prompt },
        {
          type: "file",
          file: {
            filename,
            file_data: `data:application/pdf;base64,${base64}`,
          },
        } as OpenAI.Chat.Completions.ChatCompletionContentPart,
      ];
      const response = await openai.chat.completions.create({
        model: getChatModel(),
        messages: [{ role: "user", content: pdfContent }],
        temperature: 0.2,
      });
      const text = response.choices[0]?.message?.content?.trim() ?? "";
      if (text) return truncate(text);
      throw new Error("PDF had no extractable text — try exporting as .txt or .docx");
    }

    throw new Error("Unsupported file type for AI extraction");
  } catch (error) {
    throw new Error(openAiErrorMessage(error));
  }
}

export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const safeName = path.basename(filename) || "document";

  if (!isAllowedKnowledgeFilename(safeName)) {
    throw new Error(
      "Unsupported file type. Use documents: .txt, .md, .pdf, .docx, .rtf — or images .png, .jpg",
    );
  }

  const normalizedMime = normalizeKnowledgeMimeType(safeName, mimeType);

  if (isLegacyDocFile(safeName, normalizedMime)) {
    throw new Error(
      "Old .doc format is not supported. In Word choose Save As → .docx, or export as PDF / .txt",
    );
  }

  if (isTextFile(safeName, normalizedMime)) {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new Error("File is empty");
    return truncate(text);
  }

  if (isRtfFile(safeName, normalizedMime)) {
    return extractRtfPlain(buffer);
  }

  if (isDocxFile(safeName, normalizedMime)) {
    return extractDocxText(buffer);
  }

  if (isPdfFile(safeName, normalizedMime)) {
    try {
      const local = await extractPdfLocal(buffer);
      if (local.length >= 40) return local;
    } catch (err) {
      console.warn("[extractDocumentText] pdf-parse failed:", err);
    }
    const text = await extractWithOpenAI(buffer, safeName, normalizedMime);
    if (!text) throw new Error("No text could be extracted from this PDF");
    return text;
  }

  if (isImageFile(safeName, normalizedMime)) {
    const text = await extractWithOpenAI(buffer, safeName, normalizedMime);
    if (!text) throw new Error("No text could be extracted from this image");
    return text;
  }

  throw new Error(
    "Unsupported file type. Use .txt, .md, .pdf, .docx, .rtf, or images (.png, .jpg)",
  );
}
