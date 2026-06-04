import { NextResponse } from "next/server";
import {
  clearDeepSeekReachabilityCache,
  isDeepSeekReachable,
} from "@/lib/ai/deepseek-client";
import {
  getDeepSeekBaseURL,
  getDeepSeekModel,
  isDeepSeekConfigured,
} from "@/lib/ai/deepseek-config";

export const dynamic = "force-dynamic";

function payload(reachable: boolean) {
  return {
    configured: isDeepSeekConfigured(),
    reachable,
    ready: isDeepSeekConfigured() && reachable,
    baseUrl: getDeepSeekBaseURL(),
    model: getDeepSeekModel(),
    endpoints: {
      chat: "/api/ai/deepseek/chat",
      reply: "/api/ai/deepseek/reply",
      status: "/api/ai/deepseek/status",
    },
    hint: !isDeepSeekConfigured()
      ? "missing_key"
      : !reachable
        ? "unreachable"
        : "ok",
  };
}

export async function GET() {
  const reachable = isDeepSeekConfigured() ? await isDeepSeekReachable() : false;
  return NextResponse.json(payload(reachable));
}

export async function POST() {
  clearDeepSeekReachabilityCache();
  const reachable = isDeepSeekConfigured() ? await isDeepSeekReachable() : false;
  return NextResponse.json(payload(reachable));
}
