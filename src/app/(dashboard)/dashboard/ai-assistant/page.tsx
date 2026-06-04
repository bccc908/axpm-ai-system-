"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { CustomerReplyAgent } from "@/components/ai/customer-reply-agent";
import { useLocale } from "@/components/providers/locale-provider";

function AiAssistantContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get("client") ?? undefined;
  const [clients, setClients] = useState<
    { id: string; name: string; whatsapp: string | null; wechat: string | null; notes: string | null }[]
  >([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) =>
        setClients(
          (d.clients ?? []).map(
            (c: {
              id: string;
              name: string;
              whatsapp: string | null;
              wechat: string | null;
              notes: string | null;
            }) => ({
              id: c.id,
              name: c.name,
              whatsapp: c.whatsapp,
              wechat: c.wechat,
              notes: c.notes,
            }),
          ),
        ),
      );
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("ai.agentTitle")}</h1>
          <p className="mt-1 text-muted">{t("ai.agentSubtitle")}</p>
        </div>
        <Link
          href="/dashboard/ai-assistant/test"
          className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
        >
          <FlaskConical className="h-4 w-4" />
          {t("ai.openTestPage")}
        </Link>
      </div>

      <CustomerReplyAgent clients={clients} initialClientId={initialClientId} />
    </div>
  );
}

export default function AiAssistantPage() {
  return (
    <Suspense fallback={null}>
      <AiAssistantContent />
    </Suspense>
  );
}
