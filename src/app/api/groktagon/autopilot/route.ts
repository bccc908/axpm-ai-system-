import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { getGroktagonAutopilot, saveGroktagonAutopilot } from "@/lib/groktagon/autopilot";
import { runGroktagonAutopilot } from "@/lib/groktagon/run-autopilot";
import { loadGroktagonState } from "@/lib/groktagon/state";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  prompt: z.string().max(4000).optional(),
  enabled: z.boolean().optional(),
  action: z.enum(["save", "run", "tick"]).optional(),
});

function isCron(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("tick") !== "1") return false;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (isCron(request) && new URL(request.url).searchParams.get("tick") === "1") {
    const result = await runGroktagonAutopilot();
    return NextResponse.json(result);
  }

  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const autopilot = await getGroktagonAutopilot();
  return NextResponse.json({ autopilot });
}

export async function POST(request: Request) {
  if (isCron(request) && new URL(request.url).searchParams.get("tick") === "1") {
    const result = await runGroktagonAutopilot();
    return NextResponse.json(result);
  }

  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid autopilot" }, { status: 400 });

  const action = parsed.data.action ?? "save";
  const patch: { prompt?: string; enabled?: boolean } = {};
  if (parsed.data.prompt != null) patch.prompt = parsed.data.prompt;
  if (parsed.data.enabled != null) patch.enabled = parsed.data.enabled;
  if (action === "run") patch.enabled = parsed.data.enabled ?? true;
  if (Object.keys(patch).length) await saveGroktagonAutopilot(patch);

  if (action === "save") {
    const state = await loadGroktagonState();
    return NextResponse.json({ ok: true, state, autopilot: await getGroktagonAutopilot() });
  }

  const result = await runGroktagonAutopilot({ force: action === "run" });
  const state = await loadGroktagonState();
  return NextResponse.json({ ...result, state, autopilot: await getGroktagonAutopilot() });
}
