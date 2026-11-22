import { NextResponse } from "next/server";
import { knowledgeErrorResponse, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { lookupApprovedKnowledge } from "@/lib/knowledge-base/store";

export const dynamic = "force-dynamic";

/** Reference lookup for staff tools. Approved articles only. Never sends a client message. */
export async function GET(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length > 200) {
    return NextResponse.json({ error: "搜索过长" }, { status: 400 });
  }

  try {
    const matches = await lookupApprovedKnowledge(q);
    return NextResponse.json({
      matches,
      approvedOnly: true,
      sendsToClient: false,
    });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
