import "server-only";

import { randomUUID } from "crypto";
import type { ConversationMessage } from "@/types/conversation";
import type { InboxAnalytics, InboxSession, InboxSessionStatus } from "@/types/inbox";
import type { Channel } from "@/types/database";
import { readCrmData } from "@/lib/crm/store";

type SessionFile = { sessions: InboxSession[] };

async function ensureSessionFile(): Promise<SessionFile> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const file = path.join(process.cwd(), "data", "inbox-sessions.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify({ sessions: [] }, null, 2));
  }
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as SessionFile;
}

async function writeSessionFile(data: SessionFile) {
  const fs = await import("fs/promises");
  const path = await import("path");
  const file = path.join(process.cwd(), "data", "inbox-sessions.json");
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

export function buildSessionKey(message: Pick<ConversationMessage, "client_id" | "channel" | "wechat_id" | "client_name">) {
  if (message.client_id) return `client:${message.client_id}`;
  const id = message.wechat_id ?? message.client_name ?? "unknown";
  return `${message.channel}:${id}`;
}

async function backfillFromMessages() {
  const { listMessages } = await import("@/lib/conversations/store");
  const messages = await listMessages({ limit: 2000 });
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
  );
  for (const msg of sorted) {
    await touchSessionFromMessage(msg, { skipUnread: true });
  }
}

export async function listInboxSessions(filters?: {
  status?: InboxSessionStatus | "open";
  channel?: Channel;
  assigned_to?: string;
}) {
  const data = await ensureSessionFile();
  if (data.sessions.length === 0) {
    await backfillFromMessages();
    return filterSessions((await ensureSessionFile()).sessions, filters);
  }
  return filterSessions(data.sessions, filters);
}

function filterSessions(sessions: InboxSession[], filters?: {
  status?: InboxSessionStatus | "open";
  channel?: Channel;
  assigned_to?: string;
}) {
  let rows = [...sessions].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  );
  if (filters?.status === "open") {
    rows = rows.filter((s) => s.status !== "closed");
  } else if (filters?.status) {
    rows = rows.filter((s) => s.status === filters.status);
  }
  if (filters?.channel) rows = rows.filter((s) => s.channel === filters.channel);
  if (filters?.assigned_to) rows = rows.filter((s) => s.assigned_to === filters.assigned_to);
  return rows;
}

export async function getInboxSession(id: string) {
  const sessions = await listInboxSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function getSessionByClientId(clientId: string) {
  const sessions = await listInboxSessions();
  return sessions.find((s) => s.client_id === clientId && s.status !== "closed") ?? null;
}

export async function isAiPausedForClient(clientId: string) {
  const session = await getSessionByClientId(clientId);
  return session?.status === "human";
}

export async function touchSessionFromMessage(
  message: ConversationMessage,
  opts?: { skipUnread?: boolean },
) {
  const data = await ensureSessionFile();
  const now = new Date().toISOString();
  const sessionKey = buildSessionKey(message);
  let session = data.sessions.find((s) => s.session_key === sessionKey);

  if (!session) {
    session = {
      id: randomUUID(),
      session_key: sessionKey,
      client_id: message.client_id,
      client_name: message.client_name ?? message.sender_label,
      wechat_id: message.wechat_id,
      channel: message.channel,
      status: "bot",
      assigned_to: null,
      last_message_at: message.sent_at,
      last_preview: message.content.slice(0, 160),
      message_count: 1,
      unread_count: message.direction === "inbound" ? 1 : 0,
      created_at: now,
      updated_at: now,
      handoff_at: null,
      closed_at: null,
    };
    data.sessions.unshift(session);
  } else {
    session.client_id = message.client_id ?? session.client_id;
    session.client_name = message.client_name ?? session.client_name;
    session.wechat_id = message.wechat_id ?? session.wechat_id;
    session.message_count += 1;
    session.last_message_at = message.sent_at;
    session.last_preview = message.content.slice(0, 160);
    session.updated_at = now;
    if (message.direction === "inbound" && !opts?.skipUnread) {
      if (session.status === "human" || session.status === "bot") {
        session.unread_count += 1;
      }
    }
    if (session.status === "closed" && message.direction === "inbound") {
      session.status = "bot";
      session.closed_at = null;
    }
  }

  await writeSessionFile(data);
  return session;
}

export async function updateInboxSession(
  id: string,
  patch: Partial<Pick<InboxSession, "status" | "assigned_to" | "unread_count">>,
) {
  const data = await ensureSessionFile();
  const session = data.sessions.find((s) => s.id === id);
  if (!session) return null;

  const now = new Date().toISOString();
  if (patch.status === "human" && session.status !== "human") {
    session.handoff_at = now;
    session.closed_at = null;
  }
  if (patch.status === "bot") {
    session.handoff_at = null;
  }
  if (patch.status === "closed") {
    session.closed_at = now;
  }
  if (patch.status !== undefined) session.status = patch.status;
  if (patch.assigned_to !== undefined) session.assigned_to = patch.assigned_to;
  if (patch.unread_count !== undefined) session.unread_count = patch.unread_count;
  session.updated_at = now;

  await writeSessionFile(data);
  return session;
}

export async function markSessionRead(id: string) {
  return updateInboxSession(id, { unread_count: 0 });
}

export async function getInboxAnalytics(): Promise<InboxAnalytics> {
  const [{ listMessages }, sessions] = await Promise.all([
    import("@/lib/conversations/store"),
    listInboxSessions(),
  ]);
  const messages = await listMessages({ limit: 5000 });
  const open = sessions.filter((s) => s.status !== "closed");
  const inbound = messages.filter((m) => m.direction === "inbound");
  const outbound = messages.filter((m) => m.direction === "outbound");
  const aiReplies = outbound.filter(
    (m) =>
      m.source === "web_widget" &&
      (m.sender_label.toLowerCase().includes("assistant") ||
        m.sender_label.toLowerCase().includes("axpm")),
  ).length;
  const humanReplies = outbound.length - aiReplies;
  const channels: Record<string, number> = {};
  for (const s of sessions) {
    channels[s.channel] = (channels[s.channel] ?? 0) + 1;
  }

  return {
    totalSessions: sessions.length,
    openSessions: open.length,
    botSessions: sessions.filter((s) => s.status === "bot").length,
    humanSessions: sessions.filter((s) => s.status === "human").length,
    closedSessions: sessions.filter((s) => s.status === "closed").length,
    totalMessages: messages.length,
    inboundMessages: inbound.length,
    outboundMessages: outbound.length,
    aiReplies,
    humanReplies,
    automationRate: outbound.length ? Math.round((aiReplies / outbound.length) * 100) : 0,
    channels,
  };
}

export async function resolveTeamMemberName(id: string | null) {
  if (!id) return null;
  const crm = await readCrmData();
  return crm.teamMembers.find((m) => m.id === id)?.name ?? null;
}
