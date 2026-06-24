import "server-only";

import {
  getGammaApiBaseUrl,
  getGammaApiKey,
  getGammaDefaultNumCards,
  isGammaConfigured,
} from "@/lib/ai/gamma-config";

export { isGammaConfigured };

type GammaGenerationStatus = {
  status?: string;
  gammaUrl?: string;
  exportUrl?: string;
  error?: { message?: string };
};

export async function generateGammaPresentation(params: {
  inputText: string;
  title?: string;
  numCards?: number;
  exportAs?: "pptx" | "pdf";
}): Promise<{
  gammaUrl: string;
  exportUrl: string | null;
  generationId: string;
}> {
  const apiKey = getGammaApiKey();
  if (!apiKey) {
    throw new Error("GAMMA_API_KEY not set — get one at developers.gamma.app");
  }

  const base = getGammaApiBaseUrl().replace(/\/$/, "");
  const exportAs = params.exportAs ?? "pptx";

  const startRes = await fetch(`${base}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      inputText: params.inputText.slice(0, 8000),
      title: params.title?.slice(0, 120),
      textMode: "generate",
      format: "presentation",
      numCards: params.numCards ?? getGammaDefaultNumCards(),
      exportAs,
      textOptions: {
        tone: "professional, direct, data-driven",
        audience: "business partners and financial professionals",
        language: /[\u4e00-\u9fff]/.test(params.inputText) ? "zh" : "en",
      },
      imageOptions: {
        source: "aiGenerated",
      },
    }),
  });

  const startData = (await startRes.json().catch(() => ({}))) as {
    generationId?: string;
    message?: string;
  };

  if (!startRes.ok || !startData.generationId) {
    throw new Error(startData.message ?? `Gamma API error (${startRes.status})`);
  }

  const generationId = startData.generationId;
  const deadline = Date.now() + 5 * 60_000;

  while (Date.now() < deadline) {
    await sleep(5000);

    const pollRes = await fetch(`${base}/generations/${generationId}`, {
      headers: { "X-API-KEY": apiKey, accept: "application/json" },
    });
    const pollData = (await pollRes.json().catch(() => ({}))) as GammaGenerationStatus;

    if (!pollRes.ok) {
      throw new Error(`Gamma poll failed (${pollRes.status})`);
    }

    if (pollData.status === "failed") {
      throw new Error(pollData.error?.message ?? "Gamma generation failed");
    }

    if (pollData.status === "completed") {
      if (!pollData.gammaUrl) {
        throw new Error("Gamma completed but no gammaUrl returned");
      }
      return {
        generationId,
        gammaUrl: pollData.gammaUrl,
        exportUrl: pollData.exportUrl ?? null,
      };
    }
  }

  throw new Error("Gamma generation timed out (5 min) — try again with a shorter topic");
}

export async function downloadRemoteFile(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
