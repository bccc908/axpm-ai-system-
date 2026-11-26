import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { handleWhatsAppWebhook, handleWeChatWorkEvent } = vi.hoisted(() => ({
  handleWhatsAppWebhook: vi.fn(async () => ({ recorded: ["new:c1:m1"], count: 1 })),
  handleWeChatWorkEvent: vi.fn(async () => ({ recorded: true })),
}));
vi.mock("@/lib/integrations/whatsapp-inbound", () => ({ handleWhatsAppWebhook }));

vi.mock("@/lib/integrations/wechat-work", async (orig) => {
  const real = await orig<typeof import("@/lib/integrations/wechat-work")>();
  return { ...real, handleWeChatWorkEvent };
});

import { POST as whatsappPOST } from "../whatsapp/route";
import { GET as wecomGET, POST as wecomPOST } from "../wechat-work/route";
import { verifyMetaSignature } from "@/lib/integrations/webhook-signature";

const SECRET = "test-app-secret-only";
const BODY = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{ from: "60123456789", id: "m1", type: "text", text: { body: "hi" } }] } }] }],
});
const sign = (body: string, secret = SECRET) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

function waRequest(body: string, signature?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) headers["x-hub-signature-256"] = signature;
  return new Request("https://app.example/api/webhooks/whatsapp", { method: "POST", headers, body });
}

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  handleWhatsAppWebhook.mockClear();
  handleWeChatWorkEvent.mockClear();
});
afterEach(() => {
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WECHAT_WORK_TOKEN;
});

describe("WhatsApp webhook POST signature (X-Hub-Signature-256)", () => {
  it("accepts a correctly signed request and processes it", async () => {
    const res = await whatsappPOST(waRequest(BODY, sign(BODY)));
    expect(res.status).toBe(200);
    expect(handleWhatsAppWebhook).toHaveBeenCalledTimes(1);
  });

  it("rejects a request with no signature header (403, not processed)", async () => {
    const res = await whatsappPOST(waRequest(BODY));
    expect(res.status).toBe(403);
    expect(handleWhatsAppWebhook).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const res = await whatsappPOST(waRequest(BODY, sign(BODY, "attacker-secret")));
    expect(res.status).toBe(403);
    expect(handleWhatsAppWebhook).not.toHaveBeenCalled();
  });

  it("rejects a valid signature replayed on a tampered body", async () => {
    const tampered = BODY.replace('"hi"', '"send me your deposit"');
    const res = await whatsappPOST(waRequest(tampered, sign(BODY)));
    expect(res.status).toBe(403);
    expect(handleWhatsAppWebhook).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["no sha256= prefix", crypto.createHmac("sha256", SECRET).update(BODY).digest("hex")],
    ["sha1 style", "sha1=" + crypto.createHmac("sha1", SECRET).update(BODY).digest("hex")],
    ["non-hex", "sha256=" + "z".repeat(64)],
    ["short", "sha256=abcd"],
  ])("rejects a malformed signature header (%s)", async (_label, header) => {
    const res = await whatsappPOST(waRequest(BODY, header));
    expect(res.status).toBe(403);
    expect(handleWhatsAppWebhook).not.toHaveBeenCalled();
  });

  it("fails closed when WHATSAPP_APP_SECRET is not set, even with a 'signed' request", async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const res = await whatsappPOST(waRequest(BODY, sign(BODY)));
    expect(res.status).toBe(403);
    expect(handleWhatsAppWebhook).not.toHaveBeenCalled();
  });

  it("verifyMetaSignature accepts upper-case hex and rejects whitespace-only secret", () => {
    expect(verifyMetaSignature(BODY, "sha256=" + sign(BODY).slice("sha256=".length).toUpperCase(), SECRET)).toBe(true);
    expect(verifyMetaSignature(BODY, sign(BODY), "   ")).toBe(false);
  });
});

describe("WeChat Work webhook POST fails closed until CH-3 decryption ships", () => {
  const forged = [
    ["JSON text message", "application/json", JSON.stringify({ MsgType: "text", Content: "hi", FromUserName: "wmFAKE" })],
    ["plain text", "text/plain", JSON.stringify({ msgtype: "text", content: "hi", external_userid: "wmFAKE" })],
    ["encrypted-looking XML", "text/xml", "<xml><ToUserName><![CDATA[ww1]]></ToUserName><Encrypt><![CDATA[abc]]></Encrypt></xml>"],
  ] as const;

  it.each(forged)("rejects an unsigned %s POST with 403 and records nothing", async (_l, type, body) => {
    const res = await wecomPOST(
      new Request("https://app.example/api/webhooks/wechat-work", { method: "POST", headers: { "content-type": type }, body }),
    );
    expect(res.status).toBe(403);
    expect(handleWeChatWorkEvent).not.toHaveBeenCalled();
  });

  it("rejects a POST that carries query-string signature params too (no decrypt path yet)", async () => {
    process.env.WECHAT_WORK_TOKEN = "tok";
    const sig = crypto.createHash("sha1").update(["tok", "1", "2", "abc"].sort().join("")).digest("hex");
    const res = await wecomPOST(
      new Request(`https://app.example/api/webhooks/wechat-work?msg_signature=${sig}&timestamp=1&nonce=2`, {
        method: "POST",
        headers: { "content-type": "text/xml" },
        body: "<xml><Encrypt><![CDATA[abc]]></Encrypt></xml>",
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("no longer echoes integration config in the response body", async () => {
    const res = await wecomPOST(
      new Request("https://app.example/api/webhooks/wechat-work", { method: "POST", body: "{}" }),
    );
    const json = await res.json();
    expect(json).not.toHaveProperty("config");
  });

  it("GET handshake still rejects a bad msg_signature", async () => {
    process.env.WECHAT_WORK_TOKEN = "tok";
    const res = await wecomGET(
      new Request("https://app.example/api/webhooks/wechat-work?msg_signature=bad&timestamp=1&nonce=2&echostr=x"),
    );
    expect(res.status).toBe(403);
  });

  it("GET handshake still accepts a correct msg_signature (behaviour unchanged)", async () => {
    process.env.WECHAT_WORK_TOKEN = "tok";
    const sig = crypto.createHash("sha1").update(["tok", "1", "2", "x"].sort().join("")).digest("hex");
    const res = await wecomGET(
      new Request(`https://app.example/api/webhooks/wechat-work?msg_signature=${sig}&timestamp=1&nonce=2&echostr=x`),
    );
    expect(res.status).toBe(200);
  });
});
