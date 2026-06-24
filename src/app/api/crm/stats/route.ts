import { NextResponse } from "next/server";
import { getCrmProStats, getCrmReports } from "@/lib/crm/pro-store";
import { getCrmAdvancedAnalytics } from "@/lib/crm/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, reports, analytics, zohoCounts] = await Promise.all([
    getCrmProStats(),
    getCrmReports(),
    getCrmAdvancedAnalytics(),
    import("@/lib/crm/zoho-store").then((m) => m.getZohoCrmCounts()),
  ]);
  return NextResponse.json({ ...stats, ...zohoCounts, reports, analytics });
}
