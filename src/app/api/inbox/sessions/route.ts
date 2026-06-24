import { NextResponse } from "next/server";
import type { Channel } from "@/types/database";
import type { InboxSessionStatus } from "@/types/inbox";
import { listInboxSessions, resolveTeamMemberName } from "@/lib/inbox/session-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as InboxSessionStatus | "open" | null;
  const channel = url.searchParams.get("channel") as Channel | null;
  const assignedTo = url.searchParams.get("assigned_to");

  const sessions = await listInboxSessions({
    status: status ?? undefined,
    channel: channel ?? undefined,
    assigned_to: assignedTo ?? undefined,
  });

  const enriched = await Promise.all(
    sessions.map(async (s) => ({
      ...s,
      assigned_name: await resolveTeamMemberName(s.assigned_to),
    })),
  );

  return NextResponse.json({ sessions: enriched });
}
