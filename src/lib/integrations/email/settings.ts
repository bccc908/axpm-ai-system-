import fs from "fs/promises";
import path from "path";
import type { EmailAutoSettings, EmailProvider, EmailSettings } from "@/types/email";
import { resolveSmtp } from "./providers";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export const defaultEmailSettings: EmailSettings = {
  enabled: false,
  provider: "qq",
  customHost: "",
  customPort: 587,
  customSecure: false,
  fromName: "AXPM Operations",
  recipients: [],
  ccRecipients: [],
  locale: "both",
  timezone: "Asia/Kuala_Lumpur",
  auto: {
    dailyDigest: false,
    dailyFortune: true,
    paymentReminders: true,
    clientFollowUps: true,
  },
};

export async function readEmailSettings(): Promise<EmailSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw) as { email?: Partial<EmailSettings> };
    const merged: EmailSettings = {
      ...defaultEmailSettings,
      ...data.email,
      auto: { ...defaultEmailSettings.auto, ...data.email?.auto },
    };

    const rawAuto = data.email?.auto;
    const needsFortuneMigration =
      rawAuto?.dailyFortune === undefined &&
      (rawAuto?.dailyDigest === true || merged.auto.dailyDigest);

    if (needsFortuneMigration) {
      merged.auto.dailyFortune = true;
      merged.auto.dailyDigest = false;
      await saveEmailSettings({ auto: merged.auto });
    }

    return merged;
  } catch {
    return { ...defaultEmailSettings };
  }
}

export async function saveEmailSettings(
  patch: Omit<Partial<EmailSettings>, "auto"> & { auto?: Partial<EmailAutoSettings> },
) {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  let current: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    current = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* fresh file */
  }

  const existing = (current.email as Partial<EmailSettings>) ?? {};
  current.email = {
    ...defaultEmailSettings,
    ...existing,
    ...patch,
    auto: { ...defaultEmailSettings.auto, ...existing.auto, ...patch.auto },
  };
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(current, null, 2));
  return current.email as EmailSettings;
}

export function getEmailCredentials() {
  const user = process.env.EMAIL_SMTP_USER?.trim() ?? "";
  const pass = process.env.EMAIL_SMTP_PASS?.trim() ?? "";
  return { user, pass, hasCredentials: Boolean(user && pass) };
}

export function getFromEmail() {
  return process.env.EMAIL_FROM?.trim() || getEmailCredentials().user;
}

export function parseEnvRecipients(): string[] {
  const raw = process.env.EMAIL_RECIPIENTS?.trim();
  if (!raw) return [];
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

export async function getEmailConfig() {
  const settings = await readEmailSettings();
  const creds = getEmailCredentials();
  const envRecipients = parseEnvRecipients();
  const recipients = settings.recipients.length > 0 ? settings.recipients : envRecipients;
  const smtp = resolveSmtp(settings.provider, {
    host: settings.customHost,
    port: settings.customPort,
    secure: settings.customSecure,
  });
  const fromEmail = getFromEmail();

  return {
    isReady: settings.enabled && creds.hasCredentials && recipients.length > 0 && Boolean(smtp.host && fromEmail),
    hasCredentials: creds.hasCredentials,
    hasRecipients: recipients.length > 0,
    settings: { ...settings, recipients },
    smtpHost: smtp.host,
    smtpPort: smtp.port,
    smtpSecure: smtp.secure,
    fromEmail,
    credentials: creds,
  };
}

export function normalizeProvider(value: string): EmailProvider {
  const allowed: EmailProvider[] = ["qq", "163", "126", "aliyun", "gmail", "outlook", "custom"];
  return allowed.includes(value as EmailProvider) ? (value as EmailProvider) : "qq";
}
