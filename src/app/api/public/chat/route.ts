import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWidgetChatHistory,
  handlePublicWidgetChat,
} from "@/lib/widget/chat-handler";
import { getPublicWidgetConfig, isWidgetRequestAllowed } from "@/lib/widget/config";
import { widgetCorsHeaders } from "@/lib/widget/cors";
import { updateWebVisitorName } from "@/lib/widget/web-visitor";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const postSchema = z.object({
  sessionId: z.string().min(8).max(80),
  message: z.string().min(1).max(2000),
  visitorName: z.string().max(80).optional(),
  pageUrl: z.string().max(500).optional(),
});

const nameSchema = z.object({
  sessionId: z.string().min(8).max(80),
  visitorName: z.string().min(1).max(80),
});

function corsResponse(
  origin: string | null,
  allowedOrigins: string[],
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: widgetCorsHeaders(origin, allowedOrigins),
  });
}

function requestAllowed(request: Request, config: Awaited<ReturnType<typeof getPublicWidgetConfig>>) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  return isWidgetRequestAllowed(origin, referer, config.allowedOrigins, config.apiBase);
}

export async function OPTIONS(request: Request) {
  const config = await getPublicWidgetConfig();
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: widgetCorsHeaders(origin, config.allowedOrigins),
  });
}

export async function GET(request: Request) {
  const config = await getPublicWidgetConfig();
  const origin = request.headers.get("origin");

  if (!requestAllowed(request, config)) {
    return corsResponse(origin, config.allowedOrigins, { error: "Origin not allowed" }, 403);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();

  const payload: Record<string, unknown> = {
    ok: true,
    enabled: config.enabled,
    title: config.title,
    subtitle: config.subtitle,
    welcomeMessage: config.welcomeMessage,
    buttonLabel: config.buttonLabel,
    primaryColor: config.primaryColor,
    apiBase: config.apiBase,
    widgetUrl: config.widgetUrl,
  };

  if (sessionId) {
    const since = url.searchParams.get("since")?.trim() || undefined;
    payload.messages = await getWidgetChatHistory(sessionId, since);
    const visitorModule = await import("@/lib/widget/web-visitor");
    const client = await visitorModule.findWebVisitorBySession(sessionId);
    payload.clientName = client?.name ?? null;
    if (client) {
      const { isAiPausedForClient } = await import("@/lib/inbox/session-store");
      payload.humanHandling = await isAiPausedForClient(client.id);
    }
  }

  return corsResponse(origin, config.allowedOrigins, payload);
}

export async function POST(request: Request) {
  const config = await getPublicWidgetConfig();
  const origin = request.headers.get("origin");

  if (!requestAllowed(request, config)) {
    return corsResponse(origin, config.allowedOrigins, { error: "Origin not allowed" }, 403);
  }

  if (!config.enabled) {
    return corsResponse(origin, config.allowedOrigins, { error: "Widget disabled" }, 503);
  }

  try {
    const body = await request.json();

    if (body.action === "setName") {
      const parsed = nameSchema.safeParse(body);
      if (!parsed.success) {
        return corsResponse(origin, config.allowedOrigins, { error: parsed.error.flatten() }, 400);
      }
      const client = await updateWebVisitorName(parsed.data.sessionId, parsed.data.visitorName);
      return corsResponse(origin, config.allowedOrigins, {
        ok: true,
        clientName: client?.name ?? parsed.data.visitorName,
      });
    }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return corsResponse(origin, config.allowedOrigins, { error: parsed.error.flatten() }, 400);
    }

    const result = await handlePublicWidgetChat(parsed.data);
    return corsResponse(origin, config.allowedOrigins, { ok: true, ...result });
  } catch (error) {
    console.error("[Public Widget Chat]", error);
    return corsResponse(
      origin,
      config.allowedOrigins,
      { error: error instanceof Error ? error.message : "Chat failed" },
      500,
    );
  }
}
