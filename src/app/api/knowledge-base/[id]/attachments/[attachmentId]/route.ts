import { NextResponse } from "next/server";
import { knowledgeErrorResponse, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { canEditKnowledge } from "@/lib/knowledge-base/access";
import { contentDisposition, readAttachmentFile } from "@/lib/knowledge-base/files";
import { removeArticleAttachment } from "@/lib/knowledge-base/import-articles";
import { getKnowledgeArticle } from "@/lib/knowledge-base/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  const { id, attachmentId } = await params;

  try {
    const article = await getKnowledgeArticle(id);
    const attachment = article?.attachments.find((file) => file.id === attachmentId);
    if (!article || !attachment) {
      return NextResponse.json({ error: "找不到文件" }, { status: 404 });
    }
    const buffer = await readAttachmentFile(article.id, attachment.id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": contentDisposition(attachment.fileName, attachment.mimeType),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  if (!canEditKnowledge(auth.actor.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const { id, attachmentId } = await params;

  try {
    const article = await removeArticleAttachment(id, attachmentId, auth.actor);
    return NextResponse.json({ article });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
