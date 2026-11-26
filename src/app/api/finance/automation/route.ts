import { NextResponse } from "next/server";
import { runFinanceAutomation } from "@/lib/finance/store";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";

async function isAuthorized(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runFinanceAutomation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Finance Automation]", error);
    return NextResponse.json({ error: "Finance automation failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runFinanceAutomation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Finance Automation]", error);
    return NextResponse.json({ error: "Finance automation failed" }, { status: 500 });
  }
}
