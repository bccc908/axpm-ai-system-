import { NextResponse } from "next/server";
import { z } from "zod";
import { listMessages } from "@/lib/conversations/store";
import {
  getInboxSession,
  markSessionRead,
  resolveTeamMemberName,
  updateInboxSession,
} from "@/lib/inbox/session-store";

const patchSchema = z.object({
  status: z.enum(["bot", "human", "closed"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  mark_read: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getInboxSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const messages = session.client_id
    ? await listMessages({ client_id: session.client_id, limit: 100 })
    : [];

  const thread = [...messages].reverse();
  const assigned_name = await resolveTeamMemberName(session.assigned_to);

  return NextResponse.json({ session: { ...session, assigned_name }, messages: thread });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.mark_read) {
      const session = await markSessionRead(id);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      return NextResponse.json({ session });
    }

    const session = await updateInboxSession(id, {
      status: parsed.data.status,
      assigned_to: parsed.data.assigned_to,
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const assigned_name = await resolveTeamMemberName(session.assigned_to);
    return NextResponse.json({ session: { ...session, assigned_name } });
  } catch (error) {
    console.error("[Inbox session PATCH]", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
