import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { modulesForRole } from "@/lib/auth/permissions";
import { needsSetup, toPublicUser, findUserById } from "@/lib/auth/store";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  const setupRequired = await needsSetup();
  if (setupRequired) {
    return NextResponse.json({ setupRequired: true, user: null, modules: [] });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ setupRequired: false, user: null, modules: [] });
  }

  const user = await findUserById(session.sub);
  if (!user) {
    return NextResponse.json({ setupRequired: false, user: null, modules: [] });
  }

  return NextResponse.json({
    setupRequired: false,
    user: toPublicUser(user),
    modules: modulesForRole(user.role),
  });
}
