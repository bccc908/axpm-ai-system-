import type { Locale } from "@/lib/i18n/types";

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

function wrapHtml(title: string, body: string, locale: Locale) {
  const footer =
    locale === "zh"
      ? "此邮件由 AXPM AI 运营系统自动发送"
      : "Sent automatically by AXPM AI Operation System";
  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:640px;margin:0 auto;padding:24px;">
  <div style="border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">
    <strong style="font-size:18px;color:#2563eb;">AXPM</strong>
    <span style="color:#666;margin-left:8px;">${title}</span>
  </div>
  ${body}
  <p style="margin-top:32px;font-size:12px;color:#888;">${footer}</p>
</body>
</html>`;
}

function section(title: string, rows: string[]) {
  if (!rows.length) return "";
  return `<h3 style="margin:20px 0 8px;font-size:15px;">${title}</h3><ul style="margin:0;padding-left:20px;">${rows.map((r) => `<li>${r}</li>`).join("")}</ul>`;
}

export function buildTestEmail(locale: Locale, timezone: string): EmailContent {
  const now = new Date().toLocaleString(locale === "zh" ? "zh-CN" : "en-MY", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (locale === "zh") {
    return {
      subject: "AXPM 邮件测试 — 连接成功",
      text: `AXPM 邮件系统测试成功。\n\n时间：${now}\n时区：${timezone}\n\n如果您收到此邮件，说明 SMTP 配置正确。`,
      html: wrapHtml(
        "邮件测试",
        `<p>AXPM 邮件系统测试成功。</p><p><strong>时间：</strong>${now}<br><strong>时区：</strong>${timezone}</p><p>如果您收到此邮件，说明 SMTP 配置正确。</p>`,
        locale,
      ),
    };
  }

  return {
    subject: "AXPM Email Test — Connection Successful",
    text: `AXPM email system test successful.\n\nTime: ${now}\nTimezone: ${timezone}\n\nIf you received this, SMTP is configured correctly.`,
    html: wrapHtml(
      "Email Test",
      `<p>AXPM email system test successful.</p><p><strong>Time:</strong> ${now}<br><strong>Timezone:</strong> ${timezone}</p><p>If you received this, SMTP is configured correctly.</p>`,
      locale,
    ),
  };
}

export function buildDailyDigestEmail(params: {
  locale: Locale;
  timezone: string;
  dateLabel: string;
  planLine: string;
  pendingJobs: { priority: string; title: string }[];
  financeLines: string[];
  paymentLines: string[];
  notes?: string | null;
}): EmailContent {
  const { locale, timezone, dateLabel, planLine, pendingJobs, financeLines, paymentLines, notes } = params;

  if (locale === "zh") {
    const jobRows = pendingJobs.length
      ? pendingJobs.map((j) => `[${j.priority}] ${j.title}`)
      : ["暂无待办"];
    const subject = `AXPM 每日摘要 — ${dateLabel}`;
    const text = [
      "AXPM 每日摘要",
      dateLabel,
      "",
      "我的助理",
      planLine,
      `待办工作：${pendingJobs.length}`,
      ...jobRows.map((j) => `• ${j}`),
      "",
      "本月财务",
      ...financeLines,
      ...(paymentLines.length ? ["", "即将到期付款", ...paymentLines.map((p) => `• ${p}`)] : []),
      ...(notes ? ["", `备注：${notes}`] : []),
    ].join("\n");

    return {
      subject,
      text,
      html: wrapHtml(
        "每日摘要",
        [
          `<p style="color:#666;">${dateLabel} · ${timezone}</p>`,
          section("我的助理", [`${planLine}`, `待办工作：${pendingJobs.length}`, ...jobRows]),
          section("本月财务", financeLines),
          paymentLines.length ? section("即将到期付款", paymentLines) : "",
          notes ? `<p><strong>备注：</strong>${notes}</p>` : "",
        ].join(""),
        locale,
      ),
    };
  }

  const jobRows = pendingJobs.length
    ? pendingJobs.map((j) => `[${j.priority}] ${j.title}`)
    : ["All clear"];
  const subject = `AXPM Daily Digest — ${dateLabel}`;
  const text = [
    "AXPM Daily Digest",
    dateLabel,
    "",
    "My Assistant",
    planLine,
    `Pending jobs: ${pendingJobs.length}`,
    ...jobRows.map((j) => `• ${j}`),
    "",
    "Finance This Month",
    ...financeLines,
    ...(paymentLines.length ? ["", "Payments Due Soon", ...paymentLines.map((p) => `• ${p}`)] : []),
    ...(notes ? ["", `Notes: ${notes}`] : []),
  ].join("\n");

  return {
    subject,
    text,
    html: wrapHtml(
      "Daily Digest",
      [
        `<p style="color:#666;">${dateLabel} · ${timezone}</p>`,
        section("My Assistant", [`${planLine}`, `Pending jobs: ${pendingJobs.length}`, ...jobRows]),
        section("Finance This Month", financeLines),
        paymentLines.length ? section("Payments Due Soon", paymentLines) : "",
        notes ? `<p><strong>Notes:</strong> ${notes}</p>` : "",
      ].join(""),
      locale,
    ),
  };
}

export function buildPaymentReminderEmail(params: {
  locale: Locale;
  timezone: string;
  financeLines: string[];
  dueSoon: { title: string; amount: string; when: string }[];
}): EmailContent {
  const { locale, timezone, financeLines, dueSoon } = params;

  if (locale === "zh") {
    const dueRows = dueSoon.map((p) => `${p.title} — ${p.amount}（${p.when}）`);
    return {
      subject: `AXPM 付款提醒 — ${dueSoon.length} 笔即将到期`,
      text: ["AXPM 付款提醒", "", "本月财务", ...financeLines, "", "即将到期", ...dueRows.map((r) => `• ${r}`)].join("\n"),
      html: wrapHtml(
        "付款提醒",
        [
          `<p style="color:#666;">${timezone}</p>`,
          section("本月财务", financeLines),
          section("即将到期付款", dueRows),
        ].join(""),
        locale,
      ),
    };
  }

  const dueRows = dueSoon.map((p) => `${p.title} — ${p.amount} (${p.when})`);
  return {
    subject: `AXPM Payment Reminder — ${dueSoon.length} due soon`,
    text: ["AXPM Payment Reminder", "", "Finance This Month", ...financeLines, "", "Due Soon", ...dueRows.map((r) => `• ${r}`)].join("\n"),
    html: wrapHtml(
      "Payment Reminder",
      [
        `<p style="color:#666;">${timezone}</p>`,
        section("Finance This Month", financeLines),
        section("Payments Due Soon", dueRows),
      ].join(""),
      locale,
    ),
  };
}

export function buildFollowUpEmail(params: {
  locale: Locale;
  clientName: string;
  dueAt: string;
  notes?: string | null;
}): EmailContent {
  const { locale, clientName, dueAt, notes } = params;

  if (locale === "zh") {
    return {
      subject: `AXPM 客户跟进提醒 — ${clientName}`,
      text: [`客户跟进提醒`, `客户：${clientName}`, `到期：${dueAt}`, notes ? `备注：${notes}` : ""].filter(Boolean).join("\n"),
      html: wrapHtml(
        "客户跟进提醒",
        `<p><strong>客户：</strong>${clientName}</p><p><strong>到期：</strong>${dueAt}</p>${notes ? `<p><strong>备注：</strong>${notes}</p>` : ""}`,
        locale,
      ),
    };
  }

  return {
    subject: `AXPM Follow-Up Reminder — ${clientName}`,
    text: [`Follow-Up Reminder`, `Client: ${clientName}`, `Due: ${dueAt}`, notes ? `Notes: ${notes}` : ""].filter(Boolean).join("\n"),
    html: wrapHtml(
      "Follow-Up Reminder",
      `<p><strong>Client:</strong> ${clientName}</p><p><strong>Due:</strong> ${dueAt}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}`,
      locale,
    ),
  };
}
