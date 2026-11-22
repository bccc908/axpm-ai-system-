import { knowledgeFileMime } from "@/lib/knowledge-base/file-types";
import { inferKnowledgeSection } from "@/lib/knowledge-base/routing";
import type { KnowledgeSectionId } from "@/lib/knowledge-base/sections";
import {
  isSkippedKnowledgeDriveMime,
  listDriveChildren,
  type DriveChild,
} from "@/lib/integrations/google-drive";

export type DriveKnowledgeFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
  folderPath: string;
  suggestedSection: KnowledgeSectionId | null;
};

function isImportable(file: DriveChild): boolean {
  if (file.isFolder || isSkippedKnowledgeDriveMime(file.mimeType)) return false;
  if (file.mimeType === "application/vnd.google-apps.document") return true;
  return knowledgeFileMime(file.name, file.mimeType) !== null;
}

export async function listKnowledgeDriveFiles(folderId: string): Promise<
  | { ok: true; files: DriveKnowledgeFile[]; skippedSpreadsheets: number }
  | { ok: false; error: string }
> {
  const root = await listDriveChildren(folderId);
  if (!root.ok) return root;
  const files: DriveKnowledgeFile[] = [];
  let skippedSpreadsheets = 0;

  function push(file: DriveChild, folderPath: string) {
    if (isSkippedKnowledgeDriveMime(file.mimeType)) {
      skippedSpreadsheets += 1;
      return;
    }
    if (!isImportable(file)) return;
    const location = folderPath ? `${folderPath}/${file.name}` : file.name;
    files.push({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      size: file.size,
      webViewLink: file.webViewLink,
      folderPath,
      suggestedSection: inferKnowledgeSection(location),
    });
  }

  for (const item of root.files) {
    if (!item.isFolder) {
      push(item, "");
      continue;
    }
    const children = await listDriveChildren(item.id);
    if (!children.ok) return children;
    for (const child of children.files) {
      if (child.isFolder) continue;
      push(child, item.name);
    }
  }

  return { ok: true, files: files.slice(0, 200), skippedSpreadsheets };
}
