import { NextResponse } from "next/server";
import { getEmailConfig, listEmailLog, SMTP_PRESETS } from "@/lib/integrations/email";

export async function GET() {
  const config = await getEmailConfig();
  const log = await listEmailLog(10);

  return NextResponse.json({
    email: {
      isReady: config.isReady,
      hasCredentials: config.hasCredentials,
      hasRecipients: config.hasRecipients,
      settings: config.settings,
      smtp: {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        fromEmail: config.fromEmail,
      },
      presets: SMTP_PRESETS,
    },
    log,
  });
}
