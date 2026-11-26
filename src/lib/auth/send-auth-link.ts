import { createEmailToken } from "@/lib/auth/email-token";
import { sendAuthEmail } from "@/lib/auth/mailer";
import { preparePasswordReset, prepareVerification } from "@/lib/auth/store";
import { publicAppUrl, resetEmail, verificationEmail } from "@/lib/brand/public-brand";

export async function sendVerificationLink(userId: string, rotate: boolean): Promise<boolean> {
  const prepared = await prepareVerification(userId, rotate);
  if (!prepared) return false;
  const token = await createEmailToken({
    sub: userId,
    purpose: "verify-email",
    nonce: prepared.nonce,
  });
  const url = `${publicAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const message = verificationEmail({ name: prepared.name, url });
  await sendAuthEmail({ to: prepared.email, ...message });
  return true;
}

export async function sendPasswordResetLink(email: string): Promise<boolean> {
  const prepared = await preparePasswordReset(email);
  if (!prepared) return false;
  const token = await createEmailToken({
    sub: prepared.id,
    purpose: "reset-password",
    nonce: prepared.nonce,
  });
  const url = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const message = resetEmail({ name: prepared.name, url });
  await sendAuthEmail({ to: prepared.email, ...message });
  return true;
}
