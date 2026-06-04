import { NextResponse } from "next/server";
import { sendDailyDigestEmail } from "@/lib/integrations/email";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendDigest();
}

export async function POST(request: Request) {
  if (process.env.CRON_SECRET?.trim() && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendDigest();
}

async function sendDigest() {
  try {
    const result = await sendDailyDigestEmail();
    if (!result.ok) {
      return NextResponse.json({ sent: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ sent: true, results: result.results });
  } catch (error) {
    console.error("[Email Digest]", error);
    return NextResponse.json({ error: "Failed to send email digest" }, { status: 500 });
  }
}
