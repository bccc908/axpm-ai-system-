import { NextResponse } from "next/server";
import { resolveReferrer } from "@/lib/referral";

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref");
  const referrer = await resolveReferrer(ref);
  if (!referrer) {
    return NextResponse.json({ valid: false });
  }
  return NextResponse.json({ valid: true, name: referrer.name });
}
