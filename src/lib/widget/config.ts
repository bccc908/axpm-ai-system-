import "server-only";

import { readAppSettings } from "@/lib/finance/settings";

export type PublicWidgetConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  buttonLabel: string;
  primaryColor: string;
  apiBase: string;
  widgetUrl: string;
  allowedOrigins: string[];
};

function parseOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [
      "https://www.axpmprimecn.com",
      "https://axpmprimecn.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];
  }
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function getWidgetApiBase() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function getPublicWidgetConfig(): Promise<PublicWidgetConfig> {
  const settings = await readAppSettings();
  const apiBase = getWidgetApiBase();
  const envEnabled = process.env.WIDGET_ENABLED !== "false";
  const settingsEnabled = settings.widgetEnabled !== false;

  return {
    enabled: envEnabled && settingsEnabled,
    title: settings.widgetTitle?.trim() || "信号旗在线客服",
    subtitle: settings.widgetSubtitle?.trim() || "Axel Private Market",
    welcomeMessage:
      settings.widgetWelcomeMessage?.trim() ||
      "Hello! I am the Signal Flag assistant. Ask about accounts, IB programs, or how to get started.",
    buttonLabel: settings.widgetButtonLabel?.trim() || "Chat with us",
    primaryColor: settings.widgetPrimaryColor?.trim() || "#3b82f6",
    apiBase,
    widgetUrl: `${apiBase}/widget/chat`,
    allowedOrigins: parseOrigins(process.env.WIDGET_ALLOWED_ORIGINS),
  };
}

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const host = url.hostname === "127.0.0.1" ? "localhost" : url.hostname;
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

export function isWidgetRequestAllowed(
  origin: string | null,
  referer: string | null,
  allowedOrigins: string[],
  apiBase: string,
): boolean {
  if (origin) {
    if (allowedOrigins.includes("*")) return true;
    const normalized = normalizeOrigin(origin);
    return allowedOrigins.some(
      (entry) => normalizeOrigin(entry) === normalized,
    );
  }

  if (referer) {
    try {
      const refOrigin = normalizeOrigin(new URL(referer).origin);
      const baseOrigin = normalizeOrigin(new URL(apiBase).origin);
      if (refOrigin === baseOrigin) return true;
    } catch {
      /* ignore invalid referer */
    }
  }

  return process.env.NODE_ENV !== "production";
}

/** @deprecated use isWidgetRequestAllowed */
export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  return isWidgetRequestAllowed(origin, null, allowed, getWidgetApiBase());
}

export function buildWidgetEmbedCode(appUrl: string, config: PublicWidgetConfig) {
  const base = appUrl.replace(/\/$/, "");
  const color = config.primaryColor.replace(/"/g, "");
  const label = config.buttonLabel.replace(/"/g, "");
  return `<script src="${base}/widget/axpm-chat.js" data-api="${base}" data-color="${color}" data-label="${label}" async></script>`;
}
