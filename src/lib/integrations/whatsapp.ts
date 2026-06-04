export async function sendWhatsAppMessage(
  to: string,
  message: string,
): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return false;
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

  return res.ok;
}

export function formatFollowUpReminder(params: {
  clientName: string;
  dueAt: string;
}): string {
  return `AXPM Follow-Up Reminder\n\nClient: ${params.clientName}\nDue: ${params.dueAt}\n\nPlease complete your follow-up today.`;
}
