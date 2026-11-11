/**
 * AI-generated customer replies must not go out on any client channel
 * until a human has approved the stored draft. WhatsApp / WeChat delivery
 * is deferred even after approval — approve only records the decision.
 */
export const CLIENT_AI_REPLY_REQUIRES_APPROVAL = true;

/** Channels that would reach a customer if we sent a draft. */
export const CLIENT_DELIVERY_CHANNELS = [
  "whatsapp",
  "wechat",
  "telegram",
  "web",
] as const;

export type ClientDeliveryChannel = (typeof CLIENT_DELIVERY_CHANNELS)[number];

export function isApprovedForClientSend(status: string | null | undefined): boolean {
  return status === "approved";
}

/**
 * Hard gate: support code may only call a client send function when this
 * returns true. Approval alone is not enough while WhatsApp/WeChat (and
 * widget delivery) stay deferred.
 */
export function canDeliverDraftToClient(_params: {
  status: string | null | undefined;
  channel: string;
}): boolean {
  return false;
}

export const HOLDING_REPLY_TO_VISITOR =
  "Thanks for your message. A team member will reply shortly.";

export const AI_DRAFT_SEND_BLOCKED =
  "This text is an AI draft. Review it at /dashboard/conversations#reply-drafts. Approving does not send it to a client. Type a manual staff reply to send now.";

export async function rejectIfAiDraftText(content: string): Promise<
  | { blocked: false }
  | { blocked: true; error: string; draftId: string; status: string }
> {
  const { findDraftMatchingReply } = await import("@/lib/support/reply-drafts");
  const draft = await findDraftMatchingReply(content);
  if (!draft) return { blocked: false };
  return {
    blocked: true,
    error: AI_DRAFT_SEND_BLOCKED,
    draftId: draft.id,
    status: draft.status,
  };
}
