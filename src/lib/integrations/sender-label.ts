/**
 * Neutral default sender label for outbound customer messages.
 * Compliance Hold B4: customer-facing paths must never fall back to a
 * product/brand name. Use the workspace's own display name when set.
 */
export const NEUTRAL_SENDER_LABEL_FALLBACK = "Kayden Chiew CRM";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve the sender label stored on outbound WeChat Work messages.
 * Order: workspace display name (settings, then WORKSPACE_DISPLAY_NAME env)
 * → configured WeCom sender userid → neutral fallback.
 */
export function resolveWeChatWorkSenderLabel(input: {
  workspaceDisplayName?: string | null;
  env?: Record<string, string | undefined>;
} = {}): string {
  const env = input.env ?? process.env;
  return (
    clean(input.workspaceDisplayName) ??
    clean(env.WORKSPACE_DISPLAY_NAME) ??
    clean(env.WECHAT_WORK_SENDER_USERID) ??
    NEUTRAL_SENDER_LABEL_FALLBACK
  );
}
