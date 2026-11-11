import { Suspense } from "react";
import { ConversationalInbox } from "@/components/inbox/conversational-inbox";
import { ReplyDraftQueue } from "@/components/support/reply-draft-queue";

export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <>
        <ReplyDraftQueue />
        <ConversationalInbox />
      </>
    </Suspense>
  );
}
