import { NextResponse } from "next/server";
import { z } from "zod";
import { knowledgeErrorResponse, requireKnowledgeReader } from "@/lib/knowledge-base/api-guard";
import { canEditKnowledge } from "@/lib/knowledge-base/access";
import {
  clearKnowledgeDriveFolder,
  readKnowledgeDriveFolder,
  saveKnowledgeDriveFolder,
} from "@/lib/knowledge-base/drive-settings";
import { listKnowledgeDriveFiles } from "@/lib/knowledge-base/drive-library";
import { importSelectedDriveFiles } from "@/lib/knowledge-base/drive-import";
import { KNOWLEDGE_SECTION_IDS } from "@/lib/knowledge-base/sections";
import { googleServiceAccountEmail, isGoogleServiceAccountConfigured } from "@/lib/integrations/google-drive";

export const dynamic = "force-dynamic";

async function driveStatus() {
  const connected = isGoogleServiceAccountConfigured();
  const folder = await readKnowledgeDriveFolder();
  const base = {
    connected,
    serviceAccountEmail: connected ? googleServiceAccountEmail() : null,
    folder,
    files: [] as Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string | null;
      size: number | null;
      webViewLink: string | null;
      folderPath: string;
      suggestedSection: string | null;
    }>,
    skippedSpreadsheets: 0,
    excelPage: "/dashboard/google-drive",
    error: null as string | null,
  };
  if (!connected) return { ...base, code: "not_connected" as const };
  if (!folder) return { ...base, code: "no_folder" as const };
  const listed = await listKnowledgeDriveFiles(folder.id);
  if (!listed.ok) {
    return { ...base, code: "list_failed" as const, error: listed.error };
  }
  return {
    ...base,
    code: "ready" as const,
    files: listed.files,
    skippedSpreadsheets: listed.skippedSpreadsheets,
  };
}

export async function GET() {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await driveStatus());
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

const folderSchema = z.object({
  folder: z.string().trim().min(1).max(500),
  label: z.string().trim().max(80).optional(),
});

export async function PUT(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  if (!canEditKnowledge(auth.actor.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const parsed = folderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请粘贴 Google Drive 文件夹链接" }, { status: 400 });
  }
  const saved = await saveKnowledgeDriveFolder(parsed.data.folder, parsed.data.label);
  if (!saved.ok) {
    return NextResponse.json({ error: "文件夹链接无效" }, { status: 400 });
  }
  return NextResponse.json(await driveStatus());
}

export async function DELETE() {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  if (!canEditKnowledge(auth.actor.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  await clearKnowledgeDriveFolder();
  return NextResponse.json(await driveStatus());
}

const importSchema = z.object({
  items: z
    .array(
      z.object({
        fileId: z.string().trim().min(10).max(200),
        section: z.enum(KNOWLEDGE_SECTION_IDS),
      }),
    )
    .min(1)
    .max(25),
});

export async function POST(request: Request) {
  const auth = await requireKnowledgeReader();
  if (auth.error) return auth.error;
  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请选择文件和栏目" }, { status: 400 });
  }
  try {
    const result = await importSelectedDriveFiles(parsed.data.items, auth.actor);
    return NextResponse.json(result);
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
