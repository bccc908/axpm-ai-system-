import { NextResponse } from "next/server";
import { knowledgeErrorResponse, knowledgeFlags, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import {
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  updateKnowledgeArticle,
} from "@/lib/knowledge-base/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const article = await getKnowledgeArticle(id);
    if (!article) return NextResponse.json({ error: "找不到文档" }, { status: 404 });
    return NextResponse.json({ article, ...knowledgeFlags(auth.actor) });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    const result = await updateKnowledgeArticle(id, body, auth.actor);
    return NextResponse.json({ ...result, ...knowledgeFlags(auth.actor) });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    await deleteKnowledgeArticle(id, auth.actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
