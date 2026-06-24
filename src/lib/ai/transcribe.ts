import OpenAI, { toFile } from "openai";
import { proxiedFetch } from "@/lib/ai/proxy-fetch";

export type TranscribeResult =
  | { ok: true; text: string; provider: string }
  | { ok: false; error: string };

function audioFormatFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "webm";
  if (ext === "mpeg") return "mp3";
  return ext;
}

async function transcribeWithOpenRouter(
  buffer: Buffer,
  format: string,
  language?: "en" | "zh",
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENROUTER_API_KEY is not set" };
  }

  const model =
    process.env.OPENROUTER_TRANSCRIBE_MODEL?.trim() || "openai/whisper-1";

  try {
    const res = await proxiedFetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
        "X-Title": "signal-flag",
      },
      body: JSON.stringify({
        model,
        input_audio: {
          data: buffer.toString("base64"),
          format,
        },
        language: language === "zh" ? "zh" : language === "en" ? "en" : undefined,
      }),
      signal: AbortSignal.timeout(45000),
    });

    const data = (await res.json()) as {
      text?: string;
      transcription?: string;
      output?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg = data.error?.message ?? `OpenRouter STT error (${res.status})`;
      if (res.status === 402 || msg.toLowerCase().includes("balance")) {
        return { ok: false, error: `OpenRouter audio needs balance: ${msg}` };
      }
      return { ok: false, error: msg };
    }

    const text = (data.text ?? data.transcription ?? data.output ?? "").trim();
    if (!text) {
      return { ok: false, error: "Empty transcription from OpenRouter" };
    }

    return { ok: true, text, provider: "openrouter" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenRouter STT failed";
    return { ok: false, error: message };
  }
}

async function transcribeWithOpenAI(
  buffer: Buffer,
  filename: string,
  language?: "en" | "zh",
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY is not set" };
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    fetch: proxiedFetch as typeof fetch,
  });

  try {
    const file = await toFile(buffer, filename, { type: "audio/webm" });
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: language === "zh" ? "zh" : language === "en" ? "en" : undefined,
    });

    return { ok: true, text: response.text.trim(), provider: "openai" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI Whisper failed";
    return { ok: false, error: message };
  }
}

export function getTranscribeProviders(): string[] {
  const preferred = process.env.VOICE_TRANSCRIBE_PROVIDER?.trim().toLowerCase();
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (preferred === "openrouter" && hasOpenRouter) return ["openrouter"];
  if (preferred === "openai" && hasOpenAI) return ["openai"];

  const providers: string[] = [];
  if (hasOpenRouter) providers.push("openrouter");
  if (hasOpenAI && preferred !== "openrouter") providers.push("openai");
  return providers;
}

export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  language?: "en" | "zh",
): Promise<TranscribeResult> {
  if (buffer.length < 100) {
    return { ok: false, error: "Recording too short — speak longer and try again" };
  }

  const format = audioFormatFromFilename(filename);
  const providers = getTranscribeProviders();

  if (providers.length === 0) {
    return {
      ok: false,
      error: "Add OPENROUTER_API_KEY or OPENAI_API_KEY in .env.local for voice input",
    };
  }

  const errors: string[] = [];

  for (const provider of providers) {
    const result =
      provider === "openrouter"
        ? await transcribeWithOpenRouter(buffer, format, language)
        : await transcribeWithOpenAI(buffer, filename, language);

    if (result.ok) return result;
    errors.push(`${provider}: ${result.error}`);
  }

  const combined = errors.join("; ");
  const lower = combined.toLowerCase();
  if (lower.includes("balance") || lower.includes("$0.50") || lower.includes("402")) {
    return { ok: false, error: combined };
  }

  const isNetwork =
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("connect timeout") ||
    lower.includes("aborterror");

  return {
    ok: false,
    error: isNetwork
      ? "Network error — check VPN or type manually"
      : combined || "Transcription failed",
  };
}
