import path from "path";
import { readFile } from "fs/promises";
import { withFileLock, writeJsonAtomic } from "@/lib/auth/atomic-json";
import { publicFromAddress } from "@/lib/brand/public-brand";

export interface AuthEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** When set, used instead of the default auth From address. */
  from?: string;
}

function outboxFile(): string {
  const override = process.env.AUTH_MAIL_OUTBOX?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "auth-outbox.json");
}

function mockTransportEnabled(): boolean {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const mode = process.env.AUTH_EMAIL_MODE?.trim().toLowerCase();
  return mode === "mock" || key === "mock" || key === "";
}

function chosenFrom(override: string | undefined): string {
  const trimmed = override?.replace(/[\r\n]/g, "").trim() ?? "";
  if (!trimmed) return publicFromAddress();
  return trimmed;
}

export async function sendAuthEmail(message: AuthEmail): Promise<{ mocked: boolean; id?: string }> {
  const from = chosenFrom(message.from);
  const payload = {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };

  if (mockTransportEnabled()) {
    if (process.env.NODE_ENV === "production" && process.env.RESEND_API_KEY?.trim() !== "mock" && process.env.AUTH_EMAIL_MODE?.trim().toLowerCase() !== "mock") {
      throw new Error("RESEND_API_KEY is not set");
    }
    const file = outboxFile();
    await withFileLock(`${file}.lock`, async () => {
      let existing: unknown[] = [];
      try {
        existing = JSON.parse(await readFile(file, "utf8")) as unknown[];
        if (!Array.isArray(existing)) existing = [];
      } catch {
        existing = [];
      }
      existing.push({ at: new Date().toISOString(), mocked: true, ...payload });
      await writeJsonAtomic(file, existing);
    });
    return { mocked: true, id: "mock" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Resend ${response.status}: ${detail}`);
  }
  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return { mocked: false, id: body.id };
}
