import { prepareLocalFileImport, importPreparedArticles, type PreparedKnowledgeImport } from "@/lib/knowledge-base/import-articles";
import { readKnowledgeDriveFolder } from "@/lib/knowledge-base/drive-settings";
import { externalKeyForLink } from "@/lib/knowledge-base/links";
import { isKnowledgeSection, type KnowledgeSectionId } from "@/lib/knowledge-base/sections";
import { KnowledgeError } from "@/lib/knowledge-base/store";
import type { KnowledgeActor, KnowledgeArticle } from "@/lib/knowledge-base/types";
import {
  isGoogleServiceAccountConfigured,
  readDriveLibraryFile,
} from "@/lib/integrations/google-drive";

export async function importSelectedDriveFiles(
  items: Array<{ fileId: string; section: string }>,
  actor: KnowledgeActor,
): Promise<{ articles: KnowledgeArticle[]; created: number; updated: number; failures: Array<{ name: string; error: string }> }> {
  if (!isGoogleServiceAccountConfigured()) {
    throw new KnowledgeError(
      "Google Drive 未连接。知识库使用与 Excel 页面相同的服务账号。",
      409,
      "not_connected",
    );
  }
  const folder = await readKnowledgeDriveFolder();
  if (!folder) throw new KnowledgeError("请先保存员工资料文件夹", 400, "invalid");
  if (items.length === 0) throw new KnowledgeError("没有可导入的文件", 400, "invalid");
  if (items.length > 25) throw new KnowledgeError("一次最多导入 25 篇", 400, "invalid");

  const prepared: PreparedKnowledgeImport[] = [];
  const failures: Array<{ name: string; error: string }> = [];
  for (const item of items) {
    if (!isKnowledgeSection(item.section)) {
      failures.push({ name: item.fileId, error: "Choose a section" });
      continue;
    }
    const section: KnowledgeSectionId = item.section;
    const downloaded = await readDriveLibraryFile(item.fileId, folder.id);
    if (!downloaded.ok) {
      failures.push({ name: item.fileId, error: downloaded.error });
      continue;
    }
    const fileName =
      downloaded.mimeType === "text/plain" && !downloaded.name.toLowerCase().endsWith(".txt")
        ? `${downloaded.name}.txt`
        : downloaded.name;
    try {
      prepared.push(
        await prepareLocalFileImport({
          source: "google_drive",
          fileName,
          mimeType: downloaded.mimeType,
          buffer: downloaded.buffer,
          section,
          externalKey: externalKeyForLink({
            kind: "google_drive",
            url: downloaded.webViewLink,
            label: downloaded.name,
            fileId: item.fileId,
            folderId: null,
            vault: null,
            notePath: null,
          }),
          link: {
            kind: "google_drive",
            url: downloaded.webViewLink,
            label: downloaded.name,
          },
        }),
      );
    } catch (error) {
      failures.push({
        name: downloaded.name,
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  if (prepared.length === 0) {
    return { articles: [], created: 0, updated: 0, failures };
  }
  const result = await importPreparedArticles(prepared, actor);
  return { ...result, failures };
}
