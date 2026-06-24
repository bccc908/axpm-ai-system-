import { NextResponse } from "next/server";
import { isDalleConfigured } from "@/lib/ai/market-dalle-images";
import { isGammaConfigured } from "@/lib/ai/gamma-config";
import { isUnstructuredConfigured } from "@/lib/ai/unstructured-config";
import { isLlmConfigured } from "@/lib/ai/llm-config";
import {
  getDefaultTtsPriority,
  isLocalApiProtected,
  isMarketForceLocal,
  isSelfHostedMode,
} from "@/lib/local/self-hosted-config";
import { getActiveWebSearchProvider, isWebSearchConfigured } from "@/lib/ai/web-search-config";
import { isMiniMaxConfigured } from "@/lib/social/minimax-tts";
import { getPiperConfig, isPiperConfigured, getPiperVersion } from "@/lib/social/piper-tts";

export const dynamic = "force-dynamic";

export async function GET() {
  const piperReady = await isPiperConfigured();
  const piperVersion = piperReady ? await getPiperVersion() : null;

  return NextResponse.json({
    selfHostedMode: isSelfHostedMode(),
    marketForceLocal: isMarketForceLocal(),
    apiProtected: isLocalApiProtected(),
    endpoints: {
      status: "/api/local/status",
      tts: "POST /api/local/tts",
      ppt: "POST /api/local/ppt",
      chartPpt: "POST /api/local/chart-ppt",
      search: "POST /api/local/search",
    },
    engines: {
      llm: { ready: isLlmConfigured(), provider: "deepseek" },
      ppt: { local: true, chartPpt: true, gamma: isMarketForceLocal() ? false : isGammaConfigured() },
      tts: {
        defaultPriority: getDefaultTtsPriority(),
        piper: { ready: piperReady, version: piperVersion, model: getPiperConfig()?.model },
        mac: { ready: process.platform === "darwin" },
        edge: { ready: true },
        minimax: { ready: isMiniMaxConfigured() },
      },
      images: {
        localSvg: true,
        dalle: isMarketForceLocal() ? false : isDalleConfigured(),
      },
      documents: {
        unstructured: isMarketForceLocal() ? false : isUnstructuredConfigured(),
      },
      voiceClone: {
        ready: false,
        phase: "planned",
        note: "Voice clone needs XTTS/OpenVoice — contact for Phase 2",
      },
      webSearch: { ready: isWebSearchConfigured(), provider: getActiveWebSearchProvider() },
    },
  });
}
