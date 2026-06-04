"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CustomerReplyAgent } from "@/components/ai/customer-reply-agent";
import { ConversationRecorder } from "@/components/conversations/conversation-recorder";
import { useLocale } from "@/components/providers/locale-provider";

export default function ConversationsPage() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <CustomerReplyAgent compact />
      <p className="text-center text-xs text-muted">
        <Link
          href="/dashboard/ai-assistant"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          {t("ai.fullAgentPage")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </p>
      <ConversationRecorder />
    </div>
  );
}
