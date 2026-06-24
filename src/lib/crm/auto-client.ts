import { readAppSettings } from "@/lib/finance/settings";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import type { Channel, Client } from "@/types/database";
import { createClient, listClients, updateClient } from "@/lib/crm/store";
import { attachMessagesToClient } from "@/lib/conversations/link-client";

export type ClientContactSource = "conversation" | "register" | "whatsapp" | "wechat_work" | "web_widget";

export type EnsureClientInput = {
  name: string;
  channel: Channel;
  channelId?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  wechat?: string | null;
  ib_source?: string | null;
  notes?: string | null;
  source: ClientContactSource;
  tags?: string[];
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeWeChatId(value: string) {
  return value.trim().toLowerCase();
}

export async function isAutoCreateFromChatEnabled() {
  const settings = await readAppSettings();
  return settings.autoCreateClientsFromChat !== false;
}

export async function findClientByContact(params: {
  wechat?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}): Promise<Client | null> {
  const clients = await listClients();
  const wechat = params.wechat?.trim();
  const whatsapp = params.whatsapp?.trim();
  const email = params.email?.trim().toLowerCase();
  const phone = params.phone?.trim();
  const phoneNorm = phone ? normalizePhone(phone) : "";
  const waNorm = whatsapp ? normalizePhone(whatsapp) : "";

  for (const c of clients) {
    if (wechat && c.wechat) {
      const a = normalizeWeChatId(c.wechat);
      const b = normalizeWeChatId(wechat);
      if (a === b || a.includes(b) || b.includes(a)) return c;
    }
    if (waNorm) {
      const cw = c.whatsapp ? normalizePhone(c.whatsapp) : "";
      const cp = c.phone ? normalizePhone(c.phone) : "";
      if (cw === waNorm || cp === waNorm) return c;
    }
    if (phoneNorm) {
      const cp = c.phone ? normalizePhone(c.phone) : "";
      const cw = c.whatsapp ? normalizePhone(c.whatsapp) : "";
      if (cp === phoneNorm || cw === phoneNorm) return c;
    }
    if (email && c.email?.toLowerCase() === email) return c;
  }

  if (params.name?.trim()) {
    const nameLower = params.name.trim().toLowerCase();
    const byName = clients.find((c) => c.name.trim().toLowerCase() === nameLower);
    if (byName && !wechat && !waNorm && !phoneNorm && !email) return byName;
  }

  return null;
}

async function notifyNewClientTelegram(client: Client, source: ClientContactSource) {
  const settings = await readAppSettings();
  if (settings.notifyNewClientTelegram === false) return;

  const label =
    source === "register"
      ? "Registration link"
      : source === "whatsapp"
        ? "WhatsApp"
        : source === "wechat_work"
          ? "WeChat Work"
          : source === "web_widget"
            ? "Website chat"
            : "Conversation";

  const lines = [
    "👤 <b>New client recorded</b>",
    "",
    `<b>${escapeHtml(client.name)}</b>`,
    `Source: ${label}`,
    `Status: ${client.lead_status}`,
  ];
  if (client.whatsapp) lines.push(`WhatsApp: ${client.whatsapp}`);
  if (client.wechat) lines.push(`WeChat: ${client.wechat}`);
  if (client.email) lines.push(`Email: ${client.email}`);
  if (client.phone) lines.push(`Phone: ${client.phone}`);

  await sendTelegramMessage(lines.join("\n"));
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function channelField(
  channel: Channel,
  channelId: string | null | undefined,
): Pick<EnsureClientInput, "wechat" | "whatsapp" | "phone"> {
  const id = channelId?.trim();
  if (!id) return {};
  if (channel === "wechat") return { wechat: id };
  if (channel === "whatsapp") return { whatsapp: id };
  if (channel === "phone") return { phone: id };
  if (channel === "telegram") return { wechat: id };
  return {};
}

export async function ensureClientFromContact(
  input: EnsureClientInput,
): Promise<
  | { client: Client; created: boolean; skipped?: false }
  | { client: null; created: false; skipped: true }
> {
  const chatSources: ClientContactSource[] = ["conversation", "whatsapp", "wechat_work", "web_widget"];
  if (chatSources.includes(input.source) && !(await isAutoCreateFromChatEnabled())) {
    const existing = await findClientByContact({
      name: input.name,
      wechat: input.wechat ?? (input.channel === "wechat" ? input.channelId : null),
      whatsapp: input.whatsapp ?? (input.channel === "whatsapp" ? input.channelId : null),
      phone: input.phone,
      email: input.email,
    });
    if (existing) {
      return { client: existing, created: false };
    }
    return { client: null, created: false, skipped: true };
  }

  const channelFields = channelField(input.channel, input.channelId);
  const wechat = input.wechat ?? channelFields.wechat ?? null;
  const whatsapp = input.whatsapp ?? channelFields.whatsapp ?? null;
  const phone = input.phone ?? channelFields.phone ?? null;

  const existing = await findClientByContact({
    name: input.name,
    wechat,
    whatsapp,
    phone,
    email: input.email,
  });

  if (existing) {
    const patch: Partial<Client> = {};
    if (wechat && !existing.wechat) patch.wechat = wechat;
    if (whatsapp && !existing.whatsapp) patch.whatsapp = whatsapp;
    if (phone && !existing.phone) patch.phone = phone;
    if (input.email && !existing.email) patch.email = input.email;
    if (input.notes?.trim()) {
      const note = input.notes.trim();
      patch.notes = existing.notes ? `${existing.notes}\n${note}` : note;
    }
    const client =
      Object.keys(patch).length > 0 ? (await updateClient(existing.id, patch)) ?? existing : existing;

    await attachMessagesToClient({
      client_id: client.id,
      client_name: client.name,
      wechat_id: wechat,
      whatsapp_id: whatsapp,
    });

    return { client, created: false };
  }

  const settings = await readAppSettings();
  const now = new Date();
  const followUp = new Date(now);
  followUp.setDate(followUp.getDate() + 2);

  const sourceTag =
    input.source === "register"
      ? "register"
      : input.source === "whatsapp"
        ? "whatsapp"
        : input.source === "web_widget"
          ? "website"
          : "auto-chat";

  const autoNote = `Auto-recorded from ${input.source} on ${now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })}`;
  const client = await createClient({
    name: input.name.trim() || "Unknown contact",
    email: input.email ?? null,
    phone: phone,
    whatsapp: whatsapp,
    wechat: wechat,
    lead_status: "new",
    deposit_amount: 0,
    deposit_currency: settings.defaultFinanceCurrency === "CNY" ? "CNY" : "MYR",
    ib_source: input.ib_source ?? null,
    tags: [...new Set([...(input.tags ?? []), sourceTag])],
    assigned_to: null,
    notes: input.notes?.trim() ? `${input.notes.trim()}\n\n${autoNote}` : autoNote,
    next_follow_up_at: followUp.toISOString(),
  });

  await attachMessagesToClient({
    client_id: client.id,
    client_name: client.name,
    wechat_id: wechat,
    whatsapp_id: whatsapp,
  });

  await notifyNewClientTelegram(client, input.source);

  return { client, created: true };
}

/** Public registration form — always creates or merges */
export async function registerClientFromForm(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  wechat?: string | null;
  ib_source?: string | null;
  message?: string | null;
}) {
  const existing = await findClientByContact({
    name: input.name,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    wechat: input.wechat,
  });

  const noteLine = input.message?.trim()
    ? `Registration message: ${input.message.trim()}`
    : null;

  if (existing) {
    const patch: Partial<Client> = {
      email: input.email ?? existing.email,
      phone: input.phone ?? existing.phone,
      whatsapp: input.whatsapp ?? existing.whatsapp,
      wechat: input.wechat ?? existing.wechat,
      ib_source: input.ib_source ?? existing.ib_source,
      tags: [...new Set([...existing.tags, "register"])],
    };
    if (noteLine) {
      patch.notes = existing.notes ? `${existing.notes}\n${noteLine}` : noteLine;
    }
    const client = (await updateClient(existing.id, patch)) ?? existing;
    await (await import("@/lib/crm/zoho-store")).ensureLeadFromInbound({
      name: client.name,
      email: client.email,
      phone: client.phone,
      whatsapp: client.whatsapp,
      wechat: client.wechat,
      source: "register",
      channel: "email",
      client_id: client.id,
      notes: noteLine,
    });
    return { client, created: false };
  }

  const created = await ensureClientFromContact({
    name: input.name,
    channel: "email",
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    wechat: input.wechat,
    ib_source: input.ib_source,
    notes: noteLine ?? undefined,
    source: "register",
    tags: ["register"],
  });
  if (!created.client) {
    throw new Error("Failed to create client from registration");
  }

  await (await import("@/lib/crm/zoho-store")).ensureLeadFromInbound({
    name: created.client.name,
    email: created.client.email,
    phone: created.client.phone,
    whatsapp: created.client.whatsapp,
    wechat: created.client.wechat,
    source: "register",
    channel: "email",
    client_id: created.client.id,
    notes: noteLine,
  });

  return { client: created.client, created: created.created };
}

export function getRegisterUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}/register`;
}
