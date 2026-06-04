import fs from "fs/promises";
import path from "path";
import { getEmailConfig, readEmailSettings } from "./settings";
import { sendEmail, sendEmailInLocales } from "./sender";
import {
  buildClientFollowUpDigest,
  buildDailyDigestEmailContent,
  buildPaymentReminderEmailContent,
  buildSingleFollowUpEmail,
} from "./content";
import { buildTestEmail } from "./templates";
import { getPaymentsNeedingReminder, runFinanceAutomation } from "@/lib/finance/store";
import { isFinanceAutoMode } from "@/lib/finance/settings";
import { getCrmOverview } from "@/lib/crm/store";

export async function sendTestEmail() {
  const config = await getEmailConfig();
  return sendEmailInLocales(
    (locale) => buildTestEmail(locale, config.settings.timezone),
    { type: "test", localePref: config.settings.locale },
  );
}

export async function sendDailyDigestEmail() {
  const config = await getEmailConfig();
  if (!config.isReady) {
    return { ok: false as const, error: "Email not configured" };
  }

  const results = await sendEmailInLocales(
    (locale) => buildDailyDigestEmailContent(locale, config.settings.timezone),
    { type: "daily_digest", localePref: config.settings.locale },
  );

  const ok = results.every((r) => r.ok);
  return { ok, results };
}

export async function sendPaymentReminderEmail() {
  const config = await getEmailConfig();
  const dueSoon = await getPaymentsNeedingReminder();
  if (dueSoon.length === 0) {
    return { ok: true as const, skipped: true, reason: "No payments due soon" };
  }

  const results = await sendEmailInLocales(
    (locale) => buildPaymentReminderEmailContent(locale, config.settings.timezone),
    { type: "payment_reminder", localePref: config.settings.locale },
  );

  return { ok: results.every((r) => r.ok), results };
}

export async function sendClientFollowUpBatchEmail() {
  const config = await getEmailConfig();
  const overview = await getCrmOverview();
  if (overview.clientsDueToday.length === 0) {
    return { ok: true as const, skipped: true, reason: "No clients due today" };
  }

  const locales = config.settings.locale === "both" ? (["en", "zh"] as const) : ([config.settings.locale] as const);
  const results = [];

  for (const locale of locales) {
    const content = await buildClientFollowUpDigest(locale);
    if (!content) continue;
    results.push(
      await sendEmail(content, { type: "client_follow_up" }),
    );
  }

  return { ok: results.every((r) => r.ok), results };
}

export async function sendFollowUpEmail(params: {
  clientName: string;
  dueAt: string;
  notes?: string | null;
}) {
  const config = await getEmailConfig();
  const results = await sendEmailInLocales(
    (locale) => buildSingleFollowUpEmail(locale, params),
    { type: "client_follow_up", localePref: config.settings.locale },
  );
  return { ok: results.every((r) => r.ok), results };
}

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

async function readDigestHour() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw) as { digestHour?: number };
    return data.digestHour ?? 9;
  } catch {
    return 9;
  }
}

export async function runEmailAutomation() {
  const settings = await readEmailSettings();
  const config = await getEmailConfig();
  const digestHour = await readDigestHour();
  const output: Record<string, unknown> = { ranAt: new Date().toISOString() };

  if (!config.isReady) {
    return { ok: false, error: "Email not configured", output };
  }

  const hour = new Date().toLocaleString("en-US", {
    timeZone: settings.timezone,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = Number(hour);

  if (settings.auto.dailyDigest && currentHour === digestHour) {
    output.dailyDigest = await sendDailyDigestEmail();
  }

  if (await isFinanceAutoMode()) {
    output.financeAutomation = await runFinanceAutomation();
  }

  if (settings.auto.paymentReminders) {
    output.paymentReminders = await sendPaymentReminderEmail();
  }

  if (settings.auto.clientFollowUps) {
    output.clientFollowUps = await sendClientFollowUpBatchEmail();
  }

  return { ok: true, output };
}
