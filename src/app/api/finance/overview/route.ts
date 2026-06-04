import { NextResponse } from "next/server";
import { getFinanceOverview } from "@/lib/finance/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;
  const overview = await getFinanceOverview(month ?? undefined);
  return NextResponse.json({ overview });
}
