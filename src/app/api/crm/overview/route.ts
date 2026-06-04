import { NextResponse } from "next/server";
import { getCrmOverview } from "@/lib/crm/store";

export async function GET() {
  const overview = await getCrmOverview();
  return NextResponse.json({ overview });
}
