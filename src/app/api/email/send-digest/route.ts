import { NextResponse } from "next/server";
import { sendDailyDigestEmail } from "@/lib/integrations/email";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";

async function isAuthorized(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendDigest();
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
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
