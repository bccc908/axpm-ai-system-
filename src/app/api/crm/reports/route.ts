import { NextResponse } from "next/server";
import { getCrmReports } from "@/lib/crm/pro-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const reports = await getCrmReports();
  return NextResponse.json(reports);
}
