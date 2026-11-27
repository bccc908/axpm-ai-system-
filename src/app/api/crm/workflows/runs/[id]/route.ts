import { NextResponse } from "next/server";
import { z } from "zod";
import { decideWorkflowRun } from "@/lib/crm/workflows";
import { guardWorkflowRequest } from "@/lib/crm/workflow-guard";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    retry: z.boolean().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guardWorkflowRequest("view");
  if (!gate.ok) return gate.response;

  if (gate.ctx.user.role === "sales") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid workflow rule" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow rule" }, { status: 400 });
  }

  const outcome = await decideWorkflowRun({
    runId: id,
    decision: parsed.data.decision,
    retry: parsed.data.retry,
    actor: {
      user_id: gate.ctx.user.id,
      name: gate.ctx.user.name,
      role: gate.ctx.user.role,
    },
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({ run: outcome.run });
}
