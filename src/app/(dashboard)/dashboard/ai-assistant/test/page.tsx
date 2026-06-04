"use client";

import { Suspense } from "react";
import { ReplyBotTester } from "@/components/ai/reply-bot-tester";
import { useLocale } from "@/components/providers/locale-provider";

function TestPageContent() {
  const { t } = useLocale();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("ai.testPageTitle")}</h1>
        <p className="mt-1 text-muted">{t("ai.testPageSubtitle")}</p>
      </div>
      <ReplyBotTester />
    </div>
  );
}

export default function AiAssistantTestPage() {
  return (
    <Suspense fallback={null}>
      <TestPageContent />
    </Suspense>
  );
}
