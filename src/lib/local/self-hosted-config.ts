import "server-only";

import { isPiperConfiguredSync } from "@/lib/social/piper-tts";

export function isSelfHostedMode(): boolean {
  return process.env.SELF_HOSTED_MODE?.trim().toLowerCase() === "true";
}

export function isMarketForceLocal(): boolean {
  return (
    isSelfHostedMode() || process.env.MARKET_FORCE_LOCAL?.trim().toLowerCase() === "true"
  );
}

export function getLocalApiKey(): string | null {
  return process.env.LOCAL_API_KEY?.trim() || null;
}

export function isLocalApiProtected(): boolean {
  return Boolean(getLocalApiKey());
}

export type TtsEngineId = "piper" | "mac" | "edge" | "minimax";

export function getDefaultTtsPriority(): "piper" | "edge" | "mac" | "minimax" | "auto" {
  const env = process.env.TTS_PRIORITY?.trim().toLowerCase();
  if (
    env === "piper" ||
    env === "edge" ||
    env === "mac" ||
    env === "minimax" ||
    env === "auto"
  ) {
    return env;
  }
  if (isPiperConfiguredSync()) return "piper";
  if (process.platform === "darwin") return "mac";
  return "edge";
}

/** Own engines first — MiniMax only when user explicitly picks it. */
export function getTtsEngineOrder(
  priority: "piper" | "edge" | "mac" | "minimax" | "auto",
): TtsEngineId[] {
  switch (priority) {
    case "piper":
      return ["piper", "mac", "edge"];
    case "mac":
      return ["mac", "piper", "edge"];
    case "edge":
      return ["edge", "mac", "piper"];
    case "minimax":
      return ["minimax", "piper", "mac", "edge"];
    case "auto":
    default:
      if (isPiperConfiguredSync()) return ["piper", "mac", "edge"];
      if (process.platform === "darwin") return ["mac", "edge"];
      return ["edge", "mac"];
  }
}
