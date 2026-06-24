import "server-only";

import { findClientByContact, ensureClientFromContact } from "@/lib/crm/auto-client";
import { updateClient } from "@/lib/crm/store";
import type { Client } from "@/types/database";

function visitorEmail(sessionId: string) {
  return `visitor-${sessionId}@axpm.web`;
}

export async function findWebVisitorBySession(sessionId: string): Promise<Client | null> {
  return findClientByContact({ email: visitorEmail(sessionId) });
}

export async function ensureWebVisitorClient(
  sessionId: string,
  visitorName?: string,
): Promise<{ client: Client; created: boolean }> {
  const email = visitorEmail(sessionId);
  const existing = await findClientByContact({ email });
  if (existing) {
    if (visitorName?.trim()) {
      const updated = await updateWebVisitorName(sessionId, visitorName);
      return { client: updated ?? existing, created: false };
    }
    return { client: existing, created: false };
  }

  const result = await ensureClientFromContact({
    name: visitorName?.trim() || "Website visitor",
    channel: "web",
    channelId: sessionId,
    email,
    source: "web_widget",
    tags: ["website", "widget"],
    notes: `Web chat session: ${sessionId}`,
  });

  if (result.skipped || !result.client) {
    throw new Error("Could not create web visitor client");
  }

  return { client: result.client, created: result.created };
}

export async function updateWebVisitorName(sessionId: string, visitorName: string) {
  const name = visitorName.trim();
  if (!name) return null;

  const client = await findWebVisitorBySession(sessionId);
  if (!client) return null;

  const generic =
    client.name === "Website visitor" ||
    client.name.startsWith("Website visitor") ||
    client.tags.includes("widget");

  if (generic && client.name !== name) {
    return (await updateClient(client.id, { name })) ?? client;
  }

  return client;
}
