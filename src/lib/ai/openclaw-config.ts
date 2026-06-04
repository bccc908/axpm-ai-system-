import "server-only";

export type ReplyProvider = "openclaw" | "openai" | "auto";

export function getOpenClawGatewayURL() {
  return process.env.OPENCLAW_GATEWAY_URL?.trim() || "http://127.0.0.1:18789";
}

export function getOpenClawGatewayToken() {
  return process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || "";
}

export function getOpenClawModel() {
  return process.env.OPENCLAW_MODEL?.trim() || "openclaw/default";
}

export function isOpenClawConfigured() {
  return Boolean(getOpenClawGatewayToken());
}

export function getReplyProvider(): ReplyProvider {
  const raw = process.env.AI_REPLY_PROVIDER?.trim().toLowerCase();
  if (raw === "openclaw" || raw === "openai") return raw;
  return "auto";
}
