import { Suspense } from "react";
import { ConversationalInbox } from "@/components/inbox/conversational-inbox";

export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <ConversationalInbox />
    </Suspense>
  );
}
