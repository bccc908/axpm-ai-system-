import { rejectIfAiDraftText } from "@/lib/support/client-send-gate";

export type WhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const notifyPhone =
    process.env.WHATSAPP_NOTIFY_PHONE?.trim() ?? "";

  return {
    configured: Boolean(token && phoneNumberId),
    hasToken: Boolean(token),
    hasPhoneNumberId: Boolean(phoneNumberId),
    verifyTokenSet: Boolean(verifyToken),
    notifyPhone,
    token,
    phoneNumberId,
  };
}

export async function sendWhatsAppMessageDetailed(
  to: string,
  message: string,
): Promise<WhatsAppSendResult> {
  const blocked = await rejectIfAiDraftText(message);
  if (blocked.blocked) {
    return { ok: false, error: blocked.error };
  }

  const { token, phoneNumberId, configured } = getWhatsAppConfig();

  if (!configured) {
    return {
      ok: false,
      error: "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set in .env.local",
    };
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: data.error?.message ?? `WhatsApp API error (${res.status})`,
    };
  }

  return { ok: true, messageId: data.messages?.[0]?.id };
}

export async function sendWhatsAppMessage(
  to: string,
  message: string,
): Promise<boolean> {
  const result = await sendWhatsAppMessageDetailed(to, message);
  if (!result.ok) {
    console.warn("[WhatsApp]", result.error);
  }
  return result.ok;
}

export function formatFollowUpReminder(params: {
  clientName: string;
  dueAt: string;
}): string {
  return `Grok Trading Follow-Up Reminder\n\nClient: ${params.clientName}\nDue: ${params.dueAt}\n\nPlease complete your follow-up today.`;
}
