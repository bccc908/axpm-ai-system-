import OpenAI, { toFile } from "openai";

function getWhisperClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
  });
}

export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  language?: "en" | "zh",
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const openai = getWhisperClient();
  if (!openai) {
    return {
      ok: false,
      error:
        "Voice transcription needs OPENAI_API_KEY (Whisper). Chat AI can use DeepSeek separately.",
    };
  }

  try {
    const file = await toFile(buffer, filename, { type: "audio/webm" });
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: language === "zh" ? "zh" : language === "en" ? "en" : undefined,
    });

    return { ok: true, text: response.text.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return { ok: false, error: message };
  }
}
