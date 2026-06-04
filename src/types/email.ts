export type EmailProvider =
  | "qq"
  | "163"
  | "126"
  | "aliyun"
  | "gmail"
  | "outlook"
  | "custom";

export type EmailRegion = "cn" | "my" | "both";

export type EmailLocalePref = "en" | "zh" | "both";

export type EmailTimezone =
  | "Asia/Kuala_Lumpur"
  | "Asia/Shanghai"
  | "Asia/Hong_Kong";

export type EmailAutoSettings = {
  dailyDigest: boolean;
  paymentReminders: boolean;
  clientFollowUps: boolean;
};

export type EmailSettings = {
  enabled: boolean;
  provider: EmailProvider;
  customHost: string;
  customPort: number;
  customSecure: boolean;
  fromName: string;
  recipients: string[];
  ccRecipients: string[];
  locale: EmailLocalePref;
  timezone: EmailTimezone;
  auto: EmailAutoSettings;
};

export type EmailLogEntry = {
  id: string;
  type: "test" | "daily_digest" | "payment_reminder" | "client_follow_up" | "finance_summary";
  subject: string;
  recipients: string[];
  sentAt: string;
  ok: boolean;
  error?: string;
};

export type EmailConfig = {
  isReady: boolean;
  hasCredentials: boolean;
  hasRecipients: boolean;
  settings: EmailSettings;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  fromEmail: string;
};
