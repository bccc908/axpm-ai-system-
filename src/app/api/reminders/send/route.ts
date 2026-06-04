import { NextResponse } from "next/server";
import { z } from "zod";
import { sendFollowUpEmail } from "@/lib/integrations/email";
import { sendTelegramMessage, formatFollowUpReminder } from "@/lib/integrations/telegram";
import {
  sendWhatsAppMessage,
  formatFollowUpReminder as formatWhatsAppReminder,
} from "@/lib/integrations/whatsapp";

const schema = z.object({
  channel: z.enum(["telegram", "whatsapp", "email"]),
  clientName: z.string().min(1),
  dueAt: z.string(),
  notes: z.string().optional(),
  whatsappNumber: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { channel, clientName, dueAt, notes, whatsappNumber } = parsed.data;
    let sent = false;

    if (channel === "email") {
      const result = await sendFollowUpEmail({ clientName, dueAt, notes });
      sent = result.ok;
      if (!sent) {
        const error = result.results?.find((r) => !r.ok)?.error ?? "Failed to send email";
        return NextResponse.json({ sent: false, channel, error }, { status: 400 });
      }
    } else if (channel === "telegram") {
      const message = formatFollowUpReminder({ clientName, dueAt, notes });
      const result = await sendTelegramMessage(message);
      sent = result.ok;
      if (!result.ok) {
        return NextResponse.json({ sent: false, channel, error: result.error }, { status: 400 });
      }
    } else if (channel === "whatsapp" && whatsappNumber) {
      const message = formatWhatsAppReminder({ clientName, dueAt });
      sent = await sendWhatsAppMessage(whatsappNumber, message);
    }

    return NextResponse.json({ sent, channel });
  } catch (error) {
    console.error("[Reminders Send]", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
