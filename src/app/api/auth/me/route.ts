import { NextResponse } from "next/server";
import { readRequestLoginSessions } from "@/lib/auth/api-session";
import { modulesForRole } from "@/lib/auth/permissions";
import { needsSetup, toPublicUser, findUserById } from "@/lib/auth/store";
import type { LoginSpace, SessionPayload } from "@/lib/auth/types";

export async function GET(request: Request) {
  const setupRequired = await needsSetup();
  const requested = new URL(request.url).searchParams.get("space");
  const space: LoginSpace | null = requested === "staff" || requested === "customer" ? requested : null;
  const sessions = await readRequestLoginSessions();
  let session: SessionPayload | null;
  if (space === "staff") session = sessions.staff;
  else if (space === "customer") session = sessions.customer;
  else session = sessions.staff ?? sessions.customer;

  if (setupRequired && space !== "customer") {
    return NextResponse.json({ setupRequired: true, user: null, modules: [] });
  }

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
