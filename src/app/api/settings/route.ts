import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmailConfig } from "@/lib/integrations/email";
import { getTelegramConfig } from "@/lib/integrations/telegram";
import { getWeChatWorkConfig } from "@/lib/integrations/wechat-work";
import { getGoogleDriveConfig } from "@/lib/integrations/google-drive";
import { getSocialIntegrationStatus } from "@/lib/social/publish";
import {
  getOpenClawGatewayURL,
  getReplyProvider,
  isOpenClawConfigured,
} from "@/lib/ai/openclaw-config";
import { getLlmDisplayName, getLlmProvider, isLlmConfigured } from "@/lib/ai/llm-config";
import { isDalleConfigured } from "@/lib/ai/market-dalle-images";
import { isGammaConfigured } from "@/lib/ai/gamma-config";
import { isUnstructuredConfigured } from "@/lib/ai/unstructured-config";
import { getActiveWebSearchProvider, isWebSearchConfigured } from "@/lib/ai/web-search-config";
import { countWebWidgetMessages } from "@/lib/widget/chat-handler";
import { buildWidgetEmbedCode, getPublicWidgetConfig } from "@/lib/widget/config";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

const defaultSettings = {
  digestHour: 9,
  defaultFinanceCurrency: "MYR",
  financeAutoMode: true,
  financeStartMonth: "2026-06",
};

function isAuthSecretWeak() {
  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  if (!secret) return true;
  return secret === "signalqi-dev-change-me-in-production" || secret.length < 24;
}

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

async function writeSettings(settings: Record<string, unknown>) {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function GET() {
  const settings = await readSettings();
  const telegram = getTelegramConfig();
  const email = await getEmailConfig();
  const wechatWork = getWeChatWorkConfig();
  const social = getSocialIntegrationStatus();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const widgetConfig = await getPublicWidgetConfig();
  const widgetStats = await countWebWidgetMessages();

  return NextResponse.json({
    settings,
    integrations: {
      telegram: {
        ...telegram,
        botTokenSet: telegram.hasToken,
        chatIdSet: telegram.hasChatId,
      },
      email: {
        isReady: email.isReady,
        hasCredentials: email.hasCredentials,
        hasRecipients: email.hasRecipients,
        enabled: email.settings.enabled,
        provider: email.settings.provider,
      },
      openai: { configured: isLlmConfigured() },
      llm: {
        configured: isLlmConfigured(),
        provider: getLlmProvider(),
        label: getLlmDisplayName(),
      },
      openclaw: {
        configured: isOpenClawConfigured(),
        gatewayUrl: getOpenClawGatewayURL(),
        provider: getReplyProvider(),
      },
      supabase: {
        configured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
        ),
      },
      whatsapp: {
        configured: Boolean(
          process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
            process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
        ),
      },
      wechatWork: {
        configured: wechatWork.configured,
        canSend: wechatWork.canSend,
      },
      social: {
        facebook: social.facebook.ready,
        instagram: social.instagram.ready,
        wechatOa: social.wechat_oa.ready,
        tiktok: social.tiktok.configured,
        xiaohongshu: social.xiaohongshu.configured,
        douyin: social.douyin.configured,
      },
      googleDrive: getGoogleDriveConfig(),
      marketAi: {
        unstructured: isUnstructuredConfigured(),
        gamma: isGammaConfigured(),
        dalle: isDalleConfigured(),
        webSearch: isWebSearchConfigured(),
        webSearchProvider: getActiveWebSearchProvider(),
      },
    },
    appUrl,
    cronDigestUrl: `${appUrl}/api/digest/daily`,
    cronEmailUrl: `${appUrl}/api/email/automation`,
    cronSocialUrl: `${appUrl}/api/social/publish`,
    cronFinanceUrl: `${appUrl}/api/finance/automation`,
    whatsappWebhookUrl: `${appUrl}/api/webhooks/whatsapp`,
    whatsappVerifyTokenSet: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
    whatsappPublicUrlWarning: appUrl.includes("localhost"),
    widgetPublicUrlWarning: appUrl.includes("localhost") || appUrl.includes("127.0.0.1"),
    authSecretWarning:
      isAuthSecretWeak() &&
      !appUrl.includes("localhost") &&
      !appUrl.includes("127.0.0.1"),
    widgetDeployReady:
      !appUrl.includes("localhost") &&
      !appUrl.includes("127.0.0.1") &&
      widgetConfig.enabled,
    widgetAllowedOrigins: widgetConfig.allowedOrigins,
    financeAutoMode: settings.financeAutoMode !== false,
    financeStartMonth: settings.financeStartMonth ?? "2026-06",
    widgetEmbedCode: buildWidgetEmbedCode(appUrl, widgetConfig),
    widgetPreviewUrl: `${appUrl}/widget/chat`,
    widgetStats,
  });
}

const schema = z.object({
  digestHour: z.number().int().min(0).max(23).optional(),
  defaultFinanceCurrency: z.enum(["MYR", "CNY"]).optional(),
  financeAutoMode: z.boolean().optional(),
  financeStartMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  todoNotifyTelegram: z.boolean().optional(),
  todoNotifyWhatsapp: z.boolean().optional(),
  whatsappNotifyPhone: z.string().nullable().optional(),
  replyAgentPrompt: z.string().nullable().optional(),
  socialMarketingPrompt: z.string().nullable().optional(),
  autoCreateClientsFromChat: z.boolean().optional(),
  notifyNewClientTelegram: z.boolean().optional(),
  notifyInboundMessageTelegram: z.boolean().optional(),
  autoReplyEnabled: z.boolean().optional(),
  autoReplyWhatsApp: z.boolean().optional(),
  autoReplyWeChat: z.boolean().optional(),
  widgetEnabled: z.boolean().optional(),
  widgetTitle: z.string().nullable().optional(),
  widgetSubtitle: z.string().nullable().optional(),
  widgetWelcomeMessage: z.string().nullable().optional(),
  widgetPrimaryColor: z.string().nullable().optional(),
  widgetButtonLabel: z.string().nullable().optional(),
  crmWidgetAutoAssign: z.boolean().optional(),
  crmAssignmentIndex: z.number().int().min(0).optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const current = await readSettings();
    const next = { ...current, ...parsed.data };
    await writeSettings(next);
    return NextResponse.json({ settings: next });
  } catch (error) {
    console.error("[Settings PATCH]", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
