import "server-only";

import fs from "fs/promises";

export type MiniMaxTtsConfig = {
  apiKey: string;
  apiBase: string;
  groupId?: string;
  model: string;
  voiceId: string;
};

export function getMiniMaxConfig(): MiniMaxTtsConfig | null {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    apiBase:
      process.env.MINIMAX_API_BASE?.trim().replace(/\/$/, "") ||
      "https://api.minimaxi.com/v1",
    groupId: process.env.MINIMAX_GROUP_ID?.trim() || undefined,
    model: process.env.MINIMAX_TTS_MODEL?.trim() || "speech-02-turbo",
    voiceId: process.env.MINIMAX_VOICE_ID?.trim() || "male-qn-qingse",
  };
}

export function isMiniMaxConfigured() {
  return Boolean(getMiniMaxConfig());
}

function buildT2AUrl(config: MiniMaxTtsConfig) {
  const url = new URL(`${config.apiBase}/t2a_v2`);
  if (config.groupId) url.searchParams.set("GroupId", config.groupId);
  return url.toString();
}

export async function synthesizeMiniMaxMp3(text: string, outputPath: string) {
  const config = getMiniMaxConfig();
  if (!config) throw new Error("MINIMAX_API_KEY not configured");

  const trimmed = text.trim().slice(0, 9800);
  if (trimmed.length < 2) throw new Error("MiniMax TTS text too short");

  const response = await fetch(buildT2AUrl(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      text: trimmed,
      stream: false,
      language_boost: "Chinese",
      voice_setting: {
        voice_id: config.voiceId,
        speed: 1.08,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 44100,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
      output_format: "hex",
    }),
  });

  const data = (await response.json()) as {
    base_resp?: { status_code?: number; status_msg?: string };
    data?: { audio?: string };
  };

  const code = data.base_resp?.status_code ?? -1;
  const msg = data.base_resp?.status_msg ?? `HTTP ${response.status}`;

  if (code !== 0) {
    if (code === 2056) {
      throw new Error("MiniMax 余额不足或用量超限 — 请到 platform.minimaxi.com 充值");
    }
    if (code === 2049 || code === 1004) {
      throw new Error("MiniMax API Key 无效 — 请检查 .env.local");
    }
    throw new Error(`MiniMax TTS failed (${code}): ${msg}`);
  }

  const hex = data.data?.audio;
  if (!hex || hex.length < 32) {
    throw new Error("MiniMax returned empty audio");
  }

  const buffer = Buffer.from(hex, "hex");
  if (buffer.length < 512) {
    throw new Error("MiniMax audio too small");
  }

  await fs.writeFile(outputPath, buffer);
}
