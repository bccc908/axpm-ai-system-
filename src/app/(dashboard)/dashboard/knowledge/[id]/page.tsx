import { KnowledgeArticleScreen } from "@/components/knowledge/knowledge-article-screen";

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KnowledgeArticleScreen id={id} />;
}
