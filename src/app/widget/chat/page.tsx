"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WebsiteChatWidget } from "@/components/widget/website-chat-widget";

function WidgetChatInner() {
  const params = useSearchParams();
  return <WebsiteChatWidget embed={params.get("embed") === "1"} />;
}

export default function WidgetChatPage() {
  return (
    <Suspense fallback={null}>
      <WidgetChatInner />
    </Suspense>
  );
}
