import { NextResponse } from "next/server";
import { getOpenAIBaseURL, getLlmDisplayName, getLlmProvider, isLlmConfigured } from "@/lib/ai/openai-config";
import { isProxyConfigured } from "@/lib/ai/proxy-fetch";
import {
  clearOpenAIReachabilityCache,
  isOpenAIReachable,
} from "@/lib/ai/openai-reachable";
import {
  clearOpenClawReachabilityCache,
  isOpenClawReachable,
} from "@/lib/ai/openclaw-reachable";
import {
  getOpenClawGatewayURL,
  getReplyProvider,
  isOpenClawConfigured,
} from "@/lib/ai/openclaw-config";

export const dynamic = "force-dynamic";

function statusPayload(reachable: boolean) {
  const configured = isLlmConfigured();
  const provider = getLlmProvider();
  const usingRelay = !getOpenAIBaseURL().includes("api.openai.com");
  const proxyConfigured = isProxyConfigured();
  return {
    configured,
    reachable,
    ready: configured && reachable,
    provider,
    providerLabel: getLlmDisplayName(),
    usingRelay,
    proxyConfigured,
    hint: !configured
      ? provider === "deepseek"
        ? "missing_deepseek_key"
        : "missing_key"
      : !reachable
        ? provider === "deepseek"
          ? "deepseek_unreachable"
          : !proxyConfigured && !usingRelay
            ? "need_proxy"
            : usingRelay
              ? "relay_unreachable"
              : "network_blocked"
        : "ok",
  };
}

function openClawStatusPayload(reachable: boolean) {
  const configured = isOpenClawConfigured();
  return {
    configured,
    reachable,
    ready: configured && reachable,
    gatewayUrl: getOpenClawGatewayURL(),
    provider: getReplyProvider(),
    hint: !configured
      ? "missing_token"
      : !reachable
        ? "gateway_unreachable"
        : "ok",
  };
}

export async function GET() {
  const configured = isLlmConfigured();
  const reachable = configured ? await isOpenAIReachable() : false;
  const openclawConfigured = isOpenClawConfigured();
  const openclawReachable = openclawConfigured ? await isOpenClawReachable() : false;
  return NextResponse.json({
    ...statusPayload(reachable),
    openclaw: openClawStatusPayload(openclawReachable),
  });
}

/** Force re-check after user turns off VPN or changes network */
export async function POST() {
  clearOpenAIReachabilityCache();
  clearOpenClawReachabilityCache();
  const configured = isLlmConfigured();
  const reachable = configured ? await isOpenAIReachable() : false;
  const openclawConfigured = isOpenClawConfigured();
  const openclawReachable = openclawConfigured ? await isOpenClawReachable() : false;
  return NextResponse.json({
    ...statusPayload(reachable),
    openclaw: openClawStatusPayload(openclawReachable),
  });
}
