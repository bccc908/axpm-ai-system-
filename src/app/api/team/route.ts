import { NextResponse } from "next/server";
import { listFollowUps, listTeamMembers } from "@/lib/crm/store";

export async function GET() {
  const [followUps, teamMembers] = await Promise.all([
    listFollowUps(),
    listTeamMembers(),
  ]);
  return NextResponse.json({ followUps, teamMembers });
}
