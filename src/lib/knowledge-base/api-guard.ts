import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { canApproveKnowledge, canEditKnowledge, canReadKnowledge } from "@/lib/knowledge-base/access";
import { KnowledgeError } from "@/lib/knowledge-base/store";
import type { KnowledgeActor } from "@/lib/knowledge-base/types";

export async function requireKnowledgeReader(): Promise<
  | { actor: KnowledgeActor; error?: undefined }
  | { actor?: undefined; error: NextResponse }
> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  if (!canReadKnowledge(ctx.user.role)) {
    return { error: NextResponse.json({ error: "无权限" }, { status: 403 }) };
  }
  return {
    actor: {
      id: ctx.user.id,
      name: ctx.user.name,
      role: ctx.user.role,
    },
  };
}

export function knowledgeFlags(actor: KnowledgeActor) {
  return {
    canEdit: canEditKnowledge(actor.role),
    canApprove: canApproveKnowledge(actor.role),
  };
}

export function knowledgeErrorResponse(error: unknown) {
  if (error instanceof KnowledgeError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[knowledge-base]", error);
  return NextResponse.json({ error: "知识库操作失败" }, { status: 500 });
}
