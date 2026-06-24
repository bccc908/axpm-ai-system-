import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getWhatsAppConfig } from "@/lib/integrations/whatsapp";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export async function GET() {
  const wa = getWhatsAppConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let notifyPhone = wa.notifyPhone;
  let autoReplyWhatsApp = true;
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(raw) as {
      whatsappNotifyPhone?: string | null;
      autoReplyWhatsApp?: boolean;
    };
    if (settings.whatsappNotifyPhone?.trim()) {
      notifyPhone = settings.whatsappNotifyPhone.trim();
    }
    if (settings.autoReplyWhatsApp === false) {
      autoReplyWhatsApp = false;
    }
  } catch {
    /* optional */
  }

  return NextResponse.json({
    whatsapp: {
      configured: wa.configured,
      hasToken: wa.hasToken,
      hasPhoneNumberId: wa.hasPhoneNumberId,
      verifyTokenSet: wa.verifyTokenSet,
      notifyPhone,
      webhookUrl: `${appUrl}/api/webhooks/whatsapp`,
      publicUrlOk: !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1"),
      autoReplyWhatsApp,
    },
  });
}
