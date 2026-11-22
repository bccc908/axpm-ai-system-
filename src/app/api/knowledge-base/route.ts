import { NextResponse } from "next/server";
import { knowledgeErrorResponse, knowledgeFlags, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { isKnowledgeSection, isKnowledgeStatus } from "@/lib/knowledge-base/sections";
import { createKnowledgeArticle, listKnowledgeArticles } from "@/lib/knowledge-base/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const sectionParam = url.searchParams.get("section");
  const statusParam = url.searchParams.get("status");
  const q = url.searchParams.get("q") ?? "";
  const section = !sectionParam ? undefined : isKnowledgeSection(sectionParam) ? sectionParam : null;
  const status = !statusParam ? undefined : isKnowledgeStatus(statusParam) ? statusParam : null;
  if (section === null) {
    return NextResponse.json({ error: "未知栏目" }, { status: 400 });
  }
  if (status === null) {
    return NextResponse.json({ error: "未知状态" }, { status: 400 });
  }
  if (q.trim().length > 200) {
    return NextResponse.json({ error: "搜索过长" }, { status: 400 });
  }

  try {
    const result = await listKnowledgeArticles({
      section,
      status,
      q,
    });
    return NextResponse.json({ ...result, ...knowledgeFlags(auth.actor) });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => null);
    const article = await createKnowledgeArticle(body, auth.actor);
    return NextResponse.json({ article, ...knowledgeFlags(auth.actor) }, { status: 201 });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
