import { NextResponse } from "next/server";
import { sendTestEmail } from "@/lib/integrations/email";

export async function POST() {
  try {
    const results = await sendTestEmail();
    const ok = results.every((r) => r.ok);
    if (!ok) {
      const error = results.find((r) => !r.ok)?.error ?? "Failed to send test email";
      return NextResponse.json({ sent: false, error, results }, { status: 400 });
    }
    return NextResponse.json({ sent: true, results });
  } catch (error) {
    console.error("[Email Test]", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
