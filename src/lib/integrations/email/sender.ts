import nodemailer from "nodemailer";
import type { EmailContent } from "./templates";
import { appendEmailLog } from "./log";
import { getEmailConfig } from "./settings";
import type { EmailLogEntry } from "@/types/email";

export type SendEmailResult =
  | { ok: true; messageId: string; log: EmailLogEntry }
  | { ok: false; error: string; log?: EmailLogEntry };

export async function sendEmail(
  content: EmailContent,
  options: {
    type: EmailLogEntry["type"];
    to?: string[];
    cc?: string[];
  },
): Promise<SendEmailResult> {
  const config = await getEmailConfig();

  if (!config.settings.enabled) {
    return { ok: false, error: "Email is disabled in settings" };
  }
  if (!config.hasCredentials) {
    return { ok: false, error: "EMAIL_SMTP_USER and EMAIL_SMTP_PASS are not set in .env.local" };
  }

  const to = options.to?.length ? options.to : config.settings.recipients;
  if (!to.length) {
    return { ok: false, error: "No email recipients configured" };
  }
  if (!config.smtpHost) {
    return { ok: false, error: "SMTP host is not configured" };
  }

  const cc = options.cc?.length ? options.cc : config.settings.ccRecipients;

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      requireTLS: config.smtpPort === 587 && !config.smtpSecure,
      auth: {
        user: config.credentials.user,
        pass: config.credentials.pass,
      },
      tls: { minVersion: "TLSv1.2" },
      // DigitalOcean blocks outbound SMTP until a support ticket is approved.
      // Fail fast so daily cron does not hang on a connection timeout.
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    const info = await transporter.sendMail({
      from: `"${config.settings.fromName}" <${config.fromEmail}>`,
      to: to.join(", "),
      cc: cc.length ? cc.join(", ") : undefined,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    const log = await appendEmailLog({
      type: options.type,
      subject: content.subject,
      recipients: [...to, ...cc],
      ok: true,
    });

    return { ok: true, messageId: info.messageId ?? "", log };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    const log = await appendEmailLog({
      type: options.type,
      subject: content.subject,
      recipients: to,
      ok: false,
      error: message,
    });
    return { ok: false, error: message, log };
  }
}

export async function sendEmailInLocales(
  build: (locale: "en" | "zh") => EmailContent | Promise<EmailContent>,
  options: {
    type: EmailLogEntry["type"];
    localePref: "en" | "zh" | "both";
  },
): Promise<SendEmailResult[]> {
  const locales: ("en" | "zh")[] =
    options.localePref === "both" ? ["en", "zh"] : [options.localePref];

  const results: SendEmailResult[] = [];
  for (const locale of locales) {
    const content = await build(locale);
    results.push(await sendEmail(content, { type: options.type }));
  }
  return results;
}
