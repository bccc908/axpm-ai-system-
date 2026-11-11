import { NextResponse } from "next/server";
import { listReplyDrafts } from "@/lib/support/reply-drafts";
import type { ReplyDraftStatus } from "@/types/reply-draft";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "pending_approval" ||
    statusParam === "approved" ||
    statusParam === "rejected"
      ? (statusParam as ReplyDraftStatus)
      : undefined;
  const clientId = url.searchParams.get("client_id") ?? undefined;
  const drafts = await listReplyDrafts({ status, clientId });
  const pendingCount = drafts.filter((d) => d.status === "pending_approval").length;
  return NextResponse.json({ drafts, pendingCount: status ? drafts.length : pendingCount });
}
