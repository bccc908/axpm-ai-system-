import "server-only";

import {
  getUnstructuredApiKey,
  getUnstructuredApiUrl,
  isUnstructuredConfigured,
} from "@/lib/ai/unstructured-config";

const MAX_CHARS = 40_000;

type UnstructuredElement = {
  type?: string;
  text?: string;
  metadata?: { page_number?: number };
};

export { isUnstructuredConfigured };

export async function extractTextWithUnstructured(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string | null> {
  const apiKey = getUnstructuredApiKey();
  if (!apiKey) return null;

  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" }),
    filename,
  );
  form.append("strategy", process.env.UNSTRUCTURED_STRATEGY?.trim() || "fast");

  try {
    const res = await fetch(getUnstructuredApiUrl(), {
      method: "POST",
      headers: {
        accept: "application/json",
        "unstructured-api-key": apiKey,
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[Unstructured] partition failed:", res.status, errText.slice(0, 200));
      return null;
    }

    const elements = (await res.json()) as UnstructuredElement[];
    if (!Array.isArray(elements)) return null;

    const parts: string[] = [];
    for (const el of elements) {
      const text = el.text?.trim();
      if (!text) continue;
      if (el.type === "Title") {
        parts.push(`\n## ${text}\n`);
      } else {
        parts.push(text);
      }
    }

    const combined = parts.join("\n\n").trim();
    if (combined.length < 20) return null;
    if (combined.length <= MAX_CHARS) return combined;
    return `${combined.slice(0, MAX_CHARS)}\n\n[…truncated]`;
  } catch (error) {
    console.warn("[Unstructured] request error:", error);
    return null;
  }
}
