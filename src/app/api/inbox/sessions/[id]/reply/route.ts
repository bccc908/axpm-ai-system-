import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { generateDeepSeekCustomerReply } from "@/lib/ai/deepseek-reply";
import { generateCustomerReply } from "@/lib/ai/customer-reply";
import { getLlmProvider } from "@/lib/ai/llm-config";
import { readAppSettings } from "@/lib/finance/settings";
import { createActivity } from "@/lib/crm/pro-store";
import { deliverAgentReply } from "@/lib/inbox/deliver-reply";
import { storePendingReplyDraft } from "@/lib/support/draft-approval";
import { rejectIfAiDraftText } from "@/lib/support/client-send-gate";
import {
  getInboxSession,
  markSessionRead,
  updateInboxSession,
} from "@/lib/inbox/session-store";

const schema = z.object({
  content: z.string().min(1),
  sender_label: z.string().min(1).optional(),
  draft_only: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getInboxSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.client_id) {
      return NextResponse.json({ error: "Session has no linked client" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.draft_only) {
      return NextResponse.json({ error: "Use GET for drafts" }, { status: 400 });
    }

    const sender = parsed.data.sender_label?.trim() || "Agent";
    const blocked = await rejectIfAiDraftText(parsed.data.content);
    if (blocked.blocked) {
      return NextResponse.json(
        {
          error: blocked.error,
          sent: false,
          draftId: blocked.draftId,
          draftStatus: blocked.status,
        },
        { status: 403 },
      );
    }

    const delivered = await deliverAgentReply({
      session,
      content: parsed.data.content,
      senderLabel: sender,
    });

    if (!delivered.ok) {
      return NextResponse.json({ error: delivered.error, sent: false }, { status: 400 });
    }

    if (session.status !== "human") {
      await updateInboxSession(id, { status: "human" });
    }

    await createActivity({
      client_id: session.client_id,
      type: "message",
      title: "Agent reply sent",
      body: parsed.data.content.trim(),
      channel: session.channel,
      actor_name: sender,
      metadata: {
        direction: "outbound",
        inboxSessionId: id,
        deliverChannel: delivered.channel,
      },
    });

    await markSessionRead(id);

    return NextResponse.json({
      sent: true,
      message: delivered.message,
      channel: delivered.channel,
    });
  } catch (error) {
    console.error("[Inbox reply POST]", error);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getInboxSession(id);
  if (!session || !session.client_id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const lastInbound = url.searchParams.get("last_inbound") ?? "";

  const { listMessages } = await import("@/lib/conversations/store");
  const messages = await listMessages({ client_id: session.client_id, limit: 20 });
  const history = [...messages]
    .reverse()
    .map((m) => `${m.sender_label}: ${m.content}`)
    .join("\n");

  const trainingBrief = await getAgentTrainingBrief();
  const settings = await readAppSettings();
  const question =
    lastInbound.trim() || messages.find((m) => m.direction === "inbound")?.content || "";

  const input = {
    channel: session.channel,
    clientName: session.client_name,
    customerQuestion: question,
    conversationHistory: history || undefined,
    tone: "professional" as const,
    customBrief: trainingBrief || settings.replyAgentPrompt || undefined,
  };

  const result =
    getLlmProvider() === "deepseek"
      ? await generateDeepSeekCustomerReply(input)
      : await generateCustomerReply(input);

  const notice =
    "notice" in result && typeof result.notice === "string" ? result.notice : null;
  const stored = await storePendingReplyDraft({
    channel: session.channel,
    clientName: session.client_name,
    clientId: session.client_id,
    customerQuestion: question,
    conversationHistory: history || undefined,
    replies: result.replies,
    provider: result.fallback ? "fallback" : (result.provider ?? "ai"),
    fallback: Boolean(result.fallback),
    notice,
    source: "inbox",
  });

  return NextResponse.json({
    draft: result.replies[0]?.trim() ?? "",
    fallback: Boolean(result.fallback),
    detectedLanguage: result.detectedLanguage,
    notice,
    draftRecord: stored
      ? {
          id: stored.id,
          status: stored.status,
          notifiedTelegram: stored.notifiedTelegram,
          telegramError: stored.telegramError,
        }
      : null,
  });
}
