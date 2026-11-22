import { NextResponse } from "next/server";
import { z } from "zod";
import { knowledgeErrorResponse, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { importPreparedArticles, prepareLinkImport } from "@/lib/knowledge-base/import-articles";
import { readObsidianSettings } from "@/lib/knowledge-base/obsidian-settings";
import { KNOWLEDGE_SECTION_IDS } from "@/lib/knowledge-base/sections";
import type { PreparedKnowledgeImport } from "@/lib/knowledge-base/import-articles";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["google_drive", "obsidian"]),
  section: z.enum(KNOWLEDGE_SECTION_IDS),
  links: z.array(z.string().trim().min(1).max(2_000)).min(1).max(25),
});

export async function POST(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请粘贴链接并选择栏目" }, { status: 400 });
  }

  try {
    const settings = parsed.data.provider === "obsidian" ? await readObsidianSettings() : null;
    const prepared: PreparedKnowledgeImport[] = [];
    const failures: Array<{ name: string; error: string }> = [];
    for (const raw of parsed.data.links) {
      const link = prepareLinkImport(
        raw,
        parsed.data.provider,
        parsed.data.section,
        settings?.vaultName,
      );
      if (!link) {
        failures.push({ name: raw.slice(0, 120), error: "Unsupported link" });
        continue;
      }
      prepared.push(link);
    }
    if (prepared.length === 0) {
      return NextResponse.json(
        { error: "没有可导入的链接", articles: [], created: 0, updated: 0, failures },
        { status: 400 },
      );
    }
    const result = await importPreparedArticles(prepared, auth.actor);
    return NextResponse.json({ ...result, failures }, { status: 201 });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
