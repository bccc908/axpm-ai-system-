import crypto from "crypto";

/**
 * Meta (WhatsApp Cloud API) webhook signature check.
 * Header: X-Hub-Signature-256: sha256=<hex HMAC-SHA256(app secret, raw body)>.
 * Fails closed: no secret, no header, wrong format or wrong value -> false.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined,
): boolean {
  const secret = appSecret?.trim();
  if (!secret) return false;
  const header = signatureHeader?.trim() ?? "";
  if (!header.startsWith("sha256=")) return false;
  const given = header.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(given.toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
