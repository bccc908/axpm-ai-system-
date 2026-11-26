import { NextResponse } from "next/server";
import { runEmailAutomation } from "@/lib/integrations/email";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";

async function isAuthorized(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
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
