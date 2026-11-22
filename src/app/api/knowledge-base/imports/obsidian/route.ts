import { NextResponse } from "next/server";
import { z } from "zod";
import { knowledgeErrorResponse, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { canEditKnowledge } from "@/lib/knowledge-base/access";
import { importPreparedArticles, prepareLocalFileImport } from "@/lib/knowledge-base/import-articles";
import { externalKeyForLink, safeNotePath } from "@/lib/knowledge-base/links";
import { readObsidianSettings, saveObsidianSettings } from "@/lib/knowledge-base/obsidian-settings";
import { resolveImportSection, splitMarkdownNote } from "@/lib/knowledge-base/routing";
import { isKnowledgeSection, KNOWLEDGE_SECTION_IDS } from "@/lib/knowledge-base/sections";
import type { PreparedKnowledgeImport } from "@/lib/knowledge-base/import-articles";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  const settings = await readObsidianSettings();
  return NextResponse.json(settings);
}

const settingsSchema = z.object({
  vaultName: z.string().max(80).optional(),
  localPathLabel: z.string().max(300).optional(),
});

export async function PUT(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  if (!canEditKnowledge(auth.actor.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Obsidian 设置无效" }, { status: 400 });
  }
  const settings = await saveObsidianSettings(parsed.data);
  return NextResponse.json(settings);
}

const manifestSchema = z.object({
  vaultName: z.string().max(80).optional(),
  items: z
    .array(
      z.object({
        fileName: z.string().min(1).max(180),
        relativePath: z.string().max(300).optional(),
        section: z.enum(KNOWLEDGE_SECTION_IDS).optional(),
      }),
    )
    .min(1)
    .max(25),
});

export async function POST(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  if (!canEditKnowledge(auth.actor.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const manifest = manifestSchema.safeParse(JSON.parse(String(formData.get("manifest") ?? "")));
    if (!manifest.success) {
      return NextResponse.json({ error: "请选择要导入的笔记" }, { status: 400 });
    }
    const files = formData.getAll("file").filter((file): file is File => file instanceof File);
    if (files.length !== manifest.data.items.length) {
      return NextResponse.json({ error: "文件和清单不一致" }, { status: 400 });
    }
    const saved = await readObsidianSettings();
    const vaultName = manifest.data.vaultName?.trim() || saved.vaultName;
    const prepared: PreparedKnowledgeImport[] = [];
    const failures: Array<{ name: string; error: string }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      const item = manifest.data.items[index]!;
      const relativePath = safeNotePath(item.relativePath || file.name) || file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      const preview = buffer.subarray(0, 4000).toString("utf8");
      const note = /\.(md|markdown|txt)$/i.test(file.name) ? splitMarkdownNote(preview) : null;
      const section = resolveImportSection(item.section, relativePath, note?.section, note?.title);
      if (!section || !isKnowledgeSection(section)) {
        failures.push({ name: file.name, error: "Choose a section" });
        continue;
      }
      const notePath = safeNotePath(relativePath) || file.name;
      const linkUrl = vaultName
        ? `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(notePath)}`
        : `obsidian-note:${notePath}`;
      try {
        prepared.push(
          await prepareLocalFileImport({
            source: "obsidian",
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            buffer,
            section,
            externalKey: externalKeyForLink({
              kind: "obsidian",
              url: linkUrl,
              label: notePath.split("/").pop() || file.name,
              fileId: null,
              folderId: null,
              vault: vaultName || null,
              notePath,
            }),
            link: {
              kind: "obsidian",
              url: linkUrl,
              label: notePath.split("/").pop() || file.name,
            },
          }),
        );
      } catch (error) {
        failures.push({
          name: file.name,
          error: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    if (prepared.length === 0) {
      return NextResponse.json({ articles: [], created: 0, updated: 0, failures });
    }
    const result = await importPreparedArticles(prepared, auth.actor);
    return NextResponse.json({ ...result, failures });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
