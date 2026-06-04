export { SMTP_PRESETS, resolveSmtp, listProvidersForRegion } from "./providers";
export { defaultEmailSettings, readEmailSettings, saveEmailSettings, getEmailConfig, getEmailCredentials } from "./settings";
export { sendEmail, sendEmailInLocales } from "./sender";
export { appendEmailLog, listEmailLog } from "./log";
export {
  sendTestEmail,
  sendDailyDigestEmail,
  sendPaymentReminderEmail,
  sendClientFollowUpBatchEmail,
  sendFollowUpEmail,
  runEmailAutomation,
} from "./automation";
