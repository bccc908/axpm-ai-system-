import crypto from "crypto";
import { createMessage } from "@/lib/conversations/store";
import { listClients } from "@/lib/crm/store";
import { ensureClientFromContact } from "@/lib/crm/auto-client";
import { recordWeChatWorkMessage } from "@/lib/conversations/store";

const QYAPI = "https://qyapi.weixin.qq.com";

export type WeChatWorkConfig = {
  configured: boolean;
  canSend: boolean;
  corpIdSet: boolean;
  secretSet: boolean;
  tokenSet: boolean;
  senderUserIdSet: boolean;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export function getWeChatWorkConfig(): WeChatWorkConfig {
  const corpIdSet = Boolean(process.env.WECHAT_WORK_CORP_ID?.trim());
  const secretSet = Boolean(process.env.WECHAT_WORK_SECRET?.trim());
  const tokenSet = Boolean(process.env.WECHAT_WORK_TOKEN?.trim());
  const senderUserIdSet = Boolean(process.env.WECHAT_WORK_SENDER_USERID?.trim());
  const configured = corpIdSet && secretSet && tokenSet;
  const canSend = corpIdSet && secretSet && senderUserIdSet;

  return {
    configured,
    canSend,
    corpIdSet,
    secretSet,
    tokenSet,
    senderUserIdSet,
  };
}

export async function getWeChatWorkAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const corpid = process.env.WECHAT_WORK_CORP_ID?.trim();
  const corpsecret = process.env.WECHAT_WORK_SECRET?.trim();

  if (!corpid || !corpsecret) {
    return { ok: false, error: "WECHAT_WORK_CORP_ID and WECHAT_WORK_SECRET not set" };
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }

  const res = await fetch(
    `${QYAPI}/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${corpsecret}`,
    { cache: "no-store" },
  );
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (!data.access_token) {
    return { ok: false, error: data.errmsg ?? "Failed to get WeChat Work token" };
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 60_000,
  };

  return { ok: true, token: data.access_token };
}

export function verifyWeChatWorkUrl(params: {
  msg_signature: string;
  timestamp: string;
  nonce: string;
  echostr: string;
}): string | null {
  const token = process.env.WECHAT_WORK_TOKEN?.trim();
  if (!token) return null;

  const sorted = [token, params.timestamp, params.nonce, params.echostr].sort().join("");
  const hash = crypto.createHash("sha1").update(sorted).digest("hex");
  return hash === params.msg_signature ? params.echostr : null;
}

/** Send 1-on-1 text to external contact via 客户联系 API */
export async function sendWeChatWorkMessage(params: {
  external_userid: string;
  content: string;
  sender_userid?: string;
}): Promise<{ ok: true; msgid: string } | { ok: false; error: string }> {
  const tokenResult = await getWeChatWorkAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const sender =
    params.sender_userid?.trim() || process.env.WECHAT_WORK_SENDER_USERID?.trim();
  if (!sender) {
    return {
      ok: false,
      error: "WECHAT_WORK_SENDER_USERID not set — employee userid who owns this contact",
    };
  }

  const res = await fetch(
    `${QYAPI}/cgi-bin/externalcontact/add_msg_template?access_token=${tokenResult.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_type: "single",
        external_userid: [params.external_userid],
        sender,
        text: { content: params.content },
      }),
    },
  );

  const data = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
    msgid?: string;
    fail_list?: string[];
  };

  if (data.errcode !== 0 && data.errcode !== undefined) {
    return { ok: false, error: data.errmsg ?? `WeChat Work API error (${data.errcode})` };
  }

  if (data.fail_list?.length) {
    return {
      ok: false,
      error: `Send failed for contact — check external_userid and sender owns this client`,
    };
  }

  return { ok: true, msgid: data.msgid ?? `ww-${Date.now()}` };
}

export async function sendWeChatWorkToClient(params: {
  client_id: string;
  content: string;
}): Promise<
  | { ok: true; msgid: string; message: Awaited<ReturnType<typeof createMessage>> }
  | { ok: false; error: string }
> {
  const clients = await listClients();
  const client = clients.find((c) => c.id === params.client_id);
  if (!client) {
    return { ok: false, error: "Client not found" };
  }

  const externalUserId = client.wechat?.trim();
  if (!externalUserId) {
    return {
      ok: false,
      error: "Client has no WeChat Work external_userid — add it in Clients (e.g. woXXXX)",
    };
  }

  const sendResult = await sendWeChatWorkMessage({
    external_userid: externalUserId,
    content: params.content,
  });

  if (!sendResult.ok) return sendResult;

  const message = await createMessage({
    client_id: client.id,
    client_name: client.name,
    wechat_id: externalUserId,
    channel: "wechat",
    direction: "outbound",
    sender_label: process.env.WECHAT_WORK_SENDER_USERID ?? "AXPM Team",
    content: params.content,
    source: "wechat_work",
    external_id: sendResult.msgid,
  });

  return { ok: true, msgid: sendResult.msgid, message };
}

/** Handle WeChat Work JSON callback (external contact / customer service message). */
export async function handleWeChatWorkEvent(body: Record<string, unknown>) {
  const msgType = String(body.MsgType ?? body.msgtype ?? "");
  const content = String(body.Content ?? body.content ?? "");
  const fromUser = String(body.FromUserName ?? body.fromusername ?? body.external_userid ?? "");
  const msgId = String(body.MsgId ?? body.msgid ?? `${fromUser}-${Date.now()}`);

  if (msgType !== "text" || !content || !fromUser) {
    return { recorded: false, reason: "unsupported_or_empty" };
  }

  const ensured = await ensureClientFromContact({
    name: fromUser,
    channel: "wechat",
    channelId: fromUser,
    wechat: fromUser,
    source: "wechat_work",
  });

  if (ensured.skipped) {
    const result = await recordWeChatWorkMessage({
      external_id: msgId,
      wechat_user_id: fromUser,
      sender_label: fromUser,
      content,
      direction: "inbound",
      client_id: null,
      client_name: fromUser,
    });
    return {
      recorded: !result.duplicate,
      reason: result.duplicate ? "duplicate" : "auto_create_disabled",
      message: result.message,
    };
  }

  const client = ensured.client;
  const result = await recordWeChatWorkMessage({
    external_id: msgId,
    wechat_user_id: fromUser,
    sender_label: client.name,
    content,
    direction: "inbound",
    client_id: client.id,
    client_name: client.name,
  });

  if (result.duplicate) {
    return { recorded: false, reason: "duplicate", clientCreated: ensured.created };
  }

  const { maybeAutoReply } = await import("@/lib/ai/auto-reply");
  const auto = await maybeAutoReply({
    channel: "wechat",
    clientId: client.id,
    clientName: client.name,
    customerQuestion: content,
    sendTarget: fromUser,
  });

  return {
    recorded: true,
    message: result.message,
    clientCreated: ensured.created,
    clientId: client.id,
    autoReply: auto,
  };
}
