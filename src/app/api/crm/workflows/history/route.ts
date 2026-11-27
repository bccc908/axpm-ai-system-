import { NextResponse } from "next/server";
import { listWorkflowHistory } from "@/lib/crm/workflows";
import { guardWorkflowRequest } from "@/lib/crm/workflow-guard";
import type { CrmWorkflowRunResult } from "@/types/crm-workflows";

export const dynamic = "force-dynamic";

const RESULTS = new Set<CrmWorkflowRunResult>(["ok", "error", "waiting-approval", "rejected"]);

export async function GET(request: Request) {
  const gate = await guardWorkflowRequest("view");
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("rule_id") || undefined;
  const resultParam = url.searchParams.get("result");
  const result = resultParam && RESULTS.has(resultParam as CrmWorkflowRunResult)
    ? (resultParam as CrmWorkflowRunResult)
    : undefined;
  const runs = await listWorkflowHistory({ ruleId, result });
  return NextResponse.json({ runs });
}
