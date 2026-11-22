import { NextResponse } from "next/server";
import { knowledgeErrorResponse, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { canEditKnowledge } from "@/lib/knowledge-base/access";
import { addArticleAttachment } from "@/lib/knowledge-base/import-articles";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  if (!canEditKnowledge(auth.actor.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }
    const article = await addArticleAttachment(
      id,
      {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer: Buffer.from(await file.arrayBuffer()),
      },
      auth.actor,
    );
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
