import type { EmailProvider, EmailRegion } from "@/types/email";

export type SmtpPreset = {
  host: string;
  port: number;
  secure: boolean;
  region: EmailRegion;
  labelEn: string;
  labelZh: string;
  hintEn: string;
  hintZh: string;
};

export const SMTP_PRESETS: Record<Exclude<EmailProvider, "custom">, SmtpPreset> = {
  qq: {
    host: "smtp.qq.com",
    port: 465,
    secure: true,
    region: "cn",
    labelEn: "QQ Mail",
    labelZh: "QQ 邮箱",
    hintEn: "Enable SMTP in QQ Mail settings and use an authorization code (not your login password).",
    hintZh: "在 QQ 邮箱设置中开启 SMTP，使用授权码（不是登录密码）。",
  },
  "163": {
    host: "smtp.163.com",
    port: 465,
    secure: true,
    region: "cn",
    labelEn: "163 Mail",
    labelZh: "163 邮箱",
    hintEn: "Enable SMTP/IMAP in 163 settings and generate an authorization code.",
    hintZh: "在 163 邮箱设置中开启 SMTP，并生成授权码。",
  },
  "126": {
    host: "smtp.126.com",
    port: 465,
    secure: true,
    region: "cn",
    labelEn: "126 Mail",
    labelZh: "126 邮箱",
    hintEn: "Enable SMTP in 126 Mail settings and use an authorization code.",
    hintZh: "在 126 邮箱设置中开启 SMTP，使用授权码。",
  },
  aliyun: {
    host: "smtp.aliyun.com",
    port: 465,
    secure: true,
    region: "cn",
    labelEn: "Aliyun Enterprise Mail",
    labelZh: "阿里云企业邮箱",
    hintEn: "Use your Aliyun mail account and SMTP password from the admin console.",
    hintZh: "使用阿里云邮箱账号及控制台中的 SMTP 密码。",
  },
  gmail: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    region: "my",
    labelEn: "Gmail",
    labelZh: "Gmail",
    hintEn: "Use a Google App Password (2FA required). May be slow or blocked from mainland China.",
    hintZh: "需使用 Google 应用专用密码（需开启两步验证）。在中国大陆可能不稳定。",
  },
  outlook: {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    region: "my",
    labelEn: "Outlook / Microsoft 365",
    labelZh: "Outlook / Microsoft 365",
    hintEn: "Works well in Malaysia and internationally. Use your Microsoft account password or app password.",
    hintZh: "在马来西亚及国际环境稳定。使用 Microsoft 账号密码或应用密码。",
  },
};

export function resolveSmtp(provider: EmailProvider, custom?: {
  host?: string;
  port?: number;
  secure?: boolean;
}) {
  if (provider === "custom") {
    return {
      host: custom?.host?.trim() || process.env.EMAIL_SMTP_HOST?.trim() || "",
      port: custom?.port ?? Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: custom?.secure ?? process.env.EMAIL_SMTP_SECURE === "true",
    };
  }
  const preset = SMTP_PRESETS[provider];
  return { host: preset.host, port: preset.port, secure: preset.secure };
}

export function listProvidersForRegion(region: EmailRegion) {
  return (Object.entries(SMTP_PRESETS) as [Exclude<EmailProvider, "custom">, SmtpPreset][])
    .filter(([, p]) => region === "both" || p.region === region || p.region === "both")
    .map(([id, preset]) => ({ id, ...preset }));
}
