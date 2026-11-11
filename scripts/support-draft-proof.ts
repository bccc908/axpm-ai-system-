/**
 * Local proof only. Writes to a temp file, never to live /opt/axpm/data.
 * Does not send Telegram, WhatsApp, or WeChat. Never prints secrets.
 */
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

async function loadSecret(name: string): Promise<string | null> {
  try {
    const value = (await readFile(`/home/box/.secrets/${name}`, "utf-8")).trim();
    return value || null;
  } catch {
    return null;
  }
}

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "axpm-support-proof-"));
  const draftsFile = path.join(dir, "reply-drafts.json");
  process.env.AXPM_REPLY_DRAFTS_FILE = draftsFile;
  // Do not notify Telegram from this un-deployed local run.
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_APPROVER_CHAT_ID;

  const key = await loadSecret("deepseek_api_key");
  if (key) {
    process.env.DEEPSEEK_API_KEY = key;
    console.log("DEEPSEEK_API_KEY: present (value not printed)");
  } else {
    console.log("DEEPSEEK_API_KEY: absent on this box");
  }

  const { generateDeepSeekCustomerReply } = await import(
    "@/lib/ai/deepseek-reply"
  );
  const { storePendingReplyDraft, reviewReplyDraft } = await import(
    "@/lib/support/draft-approval"
  );

  const question =
    "This is a fake audit sample question from Support Manager, not a real client. What are your office hours?";

  const result = await generateDeepSeekCustomerReply({
    channel: "web",
    clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
    customerQuestion: question,
    tone: "professional",
  });

  console.log("deepseek_ok_or_fallback:", {
    provider: result.provider ?? null,
    fallback: Boolean(result.fallback),
    notice: result.notice ?? null,
    replyCount: result.replies.length,
    detectedLanguage: result.detectedLanguage ?? null,
  });

  const draft = await storePendingReplyDraft({
    channel: "web",
    clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
    customerQuestion: question,
    replies: result.replies,
    provider: result.provider ?? (result.fallback ? "fallback" : "deepseek"),
    fallback: Boolean(result.fallback),
    notice: result.notice ?? null,
    source: "reply_agent",
    notify: false,
  });

  console.log("stored_pending_draft:", JSON.stringify(draft, null, 2));

  const fileBody = await readFile(draftsFile, "utf-8");
  await writeFile("/tmp/axpm-support-draft-proof-record.json", fileBody);
  console.log("copied_record_to: /tmp/axpm-support-draft-proof-record.json");

  if (!draft) {
    throw new Error("No draft was stored");
  }

  const reviewed = await reviewReplyDraft({
    id: draft.id,
    decision: "approved",
    decidedBy: "local-proof",
    decisionNote: "Proof only — must not send to a client",
  });
  console.log("after_approve:", {
    ok: reviewed.ok,
    status: reviewed.ok ? reviewed.draft.status : null,
    deliveredToClient: reviewed.ok ? reviewed.deliveredToClient : null,
    deliveryAllowed: reviewed.ok ? reviewed.deliveryAllowed : null,
  });

  await rm(dir, { recursive: true, force: true });
  console.log("temp_dir_removed");
}

main().catch((err) => {
  console.error("PROOF_FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
