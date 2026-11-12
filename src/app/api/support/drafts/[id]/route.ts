import { NextResponse } from "next/server";
import { z } from "zod";
import { getReplyDraft } from "@/lib/support/reply-drafts";
import { reviewReplyDraft } from "@/lib/support/draft-approval";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decidedBy: z.string().min(1).optional(),
  decisionNote: z.string().max(2000).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const draft = await getReplyDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await reviewReplyDraft({
    id,
    decision: parsed.data.decision,
    decidedBy: parsed.data.decidedBy ?? "kayden",
    decisionNote: parsed.data.decisionNote,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  return NextResponse.json({
    draft: result.draft,
    deliveredToClient: result.deliveredToClient,
  });
}
