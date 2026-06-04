import { NextResponse } from "next/server";
import { runEmailAutomation } from "@/lib/integrations/email";

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
  return run();
}

export async function POST(request: Request) {
  if (process.env.CRON_SECRET?.trim() && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

async function run() {
  try {
    const result = await runEmailAutomation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Email Automation]", error);
    return NextResponse.json({ error: "Email automation failed" }, { status: 500 });
  }
}
