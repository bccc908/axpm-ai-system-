export const PUBLIC_BRAND = "Kayden Chiew";

export const PUBLIC_DESCRIPTION = "Account and fortune";

export function publicMetadata() {
  return {
    title: { absolute: PUBLIC_BRAND },
    applicationName: PUBLIC_BRAND,
    description: PUBLIC_DESCRIPTION,
    robots: { index: false as const, follow: false as const },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent" as const,
      title: PUBLIC_BRAND,
    },
  };
}

export function publicAppUrl(): string {
  const raw = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://127.0.0.1:3000";
  return raw.replace(/\/$/, "");
}

function containsInternalBrand(value: string): boolean {
  return value.toLowerCase().includes(["a", "x", "p", "m"].join(""));
}

/** Auth mail sender. A configured sender that uses the internal brand name is not used. */
export function publicFromAddress(): string {
  const configured = process.env.EMAIL_FROM?.trim() ?? "";
  if (configured && !containsInternalBrand(configured)) return configured;
  return `${PUBLIC_BRAND} <noreply@kaydenchiew.com>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function verificationEmail(input: { name: string; url: string }) {
  const subject = `Confirm your email — ${PUBLIC_BRAND}`;
  const text = [
    `Hello ${input.name},`,
    "",
    `Confirm your email for ${PUBLIC_BRAND}:`,
    input.url,
    "",
    "This link expires in 24 hours. You can sign in after you confirm.",
  ].join("\n");
  const html = [
    `<p>Hello ${escapeHtml(input.name)},</p>`,
    `<p>Confirm your email for ${PUBLIC_BRAND}.</p>`,
    `<p><a href="${escapeHtml(input.url)}">Confirm email</a></p>`,
    "<p>This link expires in 24 hours. You can sign in after you confirm.</p>",
  ].join("");
  return { subject, text, html };
}

export function resetEmail(input: { name: string; url: string }) {
  const subject = `Reset your password — ${PUBLIC_BRAND}`;
  const text = [
    `Hello ${input.name},`,
    "",
    `Reset your ${PUBLIC_BRAND} password:`,
    input.url,
    "",
    "This link expires in 1 hour. If you did not ask for this, you can ignore it.",
  ].join("\n");
  const html = [
    `<p>Hello ${escapeHtml(input.name)},</p>`,
    `<p>Reset your ${PUBLIC_BRAND} password.</p>`,
    `<p><a href="${escapeHtml(input.url)}">Choose a new password</a></p>`,
    "<p>This link expires in 1 hour. If you did not ask for this, you can ignore it.</p>",
  ].join("");
  return { subject, text, html };
}

const copy = {
  en: {
    verifyTitle: "Verify your email",
    verifySent: "Check your inbox for a confirmation link. You can sign in after you confirm.",
    verifySuccess: "Email confirmed. You can sign in now.",
    verifyInvalid: "This link is invalid or has expired.",
    verifyResend: "Resend confirmation",
    verifyResendOk: "If an unverified account exists for that email, a new link is on the way.",
    forgotTitle: "Reset your password",
    forgotDesc: "We will email a reset link if an account exists for that address.",
    forgotOk: "If an account exists for that email, a reset link is on the way.",
    forgotSubmit: "Email me a reset link",
    resetTitle: "Choose a new password",
    resetSuccess: "Password updated. You can sign in now.",
    resetInvalid: "This reset link is invalid or has expired.",
    resetSubmit: "Update password",
    loginUnverified: "Verify your email before signing in.",
    forgotLink: "Forgot password?",
    backToSignIn: "Back to sign in",
  },
  zh: {
    verifyTitle: "验证邮箱",
    verifySent: "请查收确认链接。确认后即可登录。",
    verifySuccess: "邮箱已确认，现在可以登录。",
    verifyInvalid: "链接无效或已过期。",
    verifyResend: "重新发送确认信",
    verifyResendOk: "如果这个邮箱有未验证的账号，新链接已发出。",
    forgotTitle: "重置密码",
    forgotDesc: "如果这个邮箱有账号，我们会发送重置链接。",
    forgotOk: "如果这个邮箱有账号，重置链接已发出。",
    forgotSubmit: "发送重置链接",
    resetTitle: "设置新密码",
    resetSuccess: "密码已更新，现在可以登录。",
    resetInvalid: "重置链接无效或已过期。",
    resetSubmit: "更新密码",
    loginUnverified: "请先验证邮箱再登录。",
    forgotLink: "忘记密码？",
    backToSignIn: "返回登录",
  },
} as const;

export type PublicLocale = keyof typeof copy;

export function publicCopy(locale: string) {
  return locale === "zh" ? copy.zh : copy.en;
}

export function renderPublicSurfaceHtml(): string {
  const pages = (["en", "zh"] as const).flatMap((locale) => {
    const text = publicCopy(locale);
    return [
      `<title>${PUBLIC_BRAND}</title>`,
      `<h1>${text.verifyTitle}</h1><p>${text.verifySent}</p>`,
      `<h1>${text.forgotTitle}</h1><p>${text.forgotDesc}</p>`,
      `<h1>${text.resetTitle}</h1><p>${text.resetSuccess}</p>`,
      `<p>${PUBLIC_BRAND}</p>`,
    ];
  });
  const verify = verificationEmail({ name: "Ada", url: "https://app.kaydenchiew.com/verify-email?token=example" });
  const reset = resetEmail({ name: "Ada", url: "https://app.kaydenchiew.com/reset-password?token=example" });
  return [
    ...pages,
    verify.subject,
    verify.text,
    verify.html,
    reset.subject,
    reset.text,
    reset.html,
    publicFromAddress(),
    PUBLIC_DESCRIPTION,
  ].join("\n");
}
