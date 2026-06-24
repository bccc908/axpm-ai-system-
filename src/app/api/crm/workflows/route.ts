import { NextResponse } from "next/server";
import { z } from "zod";
import { listCrmWorkflows, saveCrmWorkflows } from "@/lib/crm/workflows";

const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  trigger: z.enum(["deal_stage", "lead_status"]),
  trigger_value: z.string(),
  action: z.enum(["create_task", "notify_telegram"]),
  task_title: z.string(),
  telegram_message: z.string().optional(),
});

export async function GET() {
  const workflows = await listCrmWorkflows();
  return NextResponse.json({ workflows });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = z.object({ workflows: z.array(workflowSchema) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const workflows = await saveCrmWorkflows(parsed.data.workflows);
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("[CRM Workflows PATCH]", error);
    return NextResponse.json({ error: "Failed to save workflows" }, { status: 500 });
  }
}
