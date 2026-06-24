import "server-only";

import { readAppSettings } from "@/lib/finance/settings";
import { sendTelegramMessage } from "@/lib/integrations/telegram";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000"
  );
}

export async function notifyInboundMessageTelegram(params: {
  channel: "whatsapp" | "wechat" | "web_widget";
  clientName: string;
  clientId?: string | null;
  preview: string;
  created?: boolean;
}) {
  const settings = await readAppSettings();
  if (settings.notifyInboundMessageTelegram === false) return;

  const channelLabel =
    params.channel === "whatsapp"
      ? "WhatsApp"
      : params.channel === "wechat"
        ? "WeChat Work"
        : "Website chat";

  const preview = params.preview.trim().slice(0, 280);
  const base = appBaseUrl();
  const inboxUrl = params.clientId
    ? `${base}/dashboard/conversations?client=${encodeURIComponent(params.clientId)}`
    : `${base}/dashboard/conversations`;

  const lines = [
    "💬 <b>New customer message</b>",
    "",
    `<b>${escapeHtml(params.clientName)}</b> · ${channelLabel}`,
    params.created ? "<i>New client auto-created</i>" : "",
    preview ? `「${escapeHtml(preview)}」` : "",
    "",
    `<a href="${inboxUrl}">Open inbox →</a>`,
  ].filter(Boolean);

  await sendTelegramMessage(lines.join("\n"));
}
