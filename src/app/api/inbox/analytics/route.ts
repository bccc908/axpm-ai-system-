import { NextResponse } from "next/server";
import { getInboxAnalytics } from "@/lib/inbox/session-store";

export async function GET() {
  const analytics = await getInboxAnalytics();
  return NextResponse.json({ analytics });
}
