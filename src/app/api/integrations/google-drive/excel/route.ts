import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addExcelDriveFolder,
  getExcelDriveFolders,
  removeExcelDriveFolder,
} from "@/lib/integrations/google-drive-folders";
import {
  getGoogleDriveConfigAsync,
  listExcelFilesInFolder,
} from "@/lib/integrations/google-drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const folderId = new URL(request.url).searchParams.get("folderId")?.trim() ?? "";
  const config = await getGoogleDriveConfigAsync();
  const folders = await getExcelDriveFolders();

  if (!parseServiceAccountReady()) {
    return NextResponse.json({
      configured: false,
      config,
      folders,
      files: [],
      error: "Google service account not configured",
    });
  }

  if (folders.length === 0) {
    return NextResponse.json({
      configured: false,
      config,
      folders: [],
      files: [],
      error: "No Excel folders configured",
    });
  }

  const activeFolderId = folderId || folders[0].id;
  const listed = await listExcelFilesInFolder(activeFolderId);
  if (!listed.ok) {
    return NextResponse.json(
      { configured: true, config, folders, files: [], activeFolderId, error: listed.error },
      { status: 502 },
    );
  }

  return NextResponse.json({
    configured: true,
    config,
    folders,
    files: listed.files,
    activeFolderId,
  });
}

const postSchema = z.object({
  folderId: z.string().min(1),
  label: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const result = await addExcelDriveFolder(parsed.data.folderId, parsed.data.label);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ folders: result.folders });
}

export async function DELETE(request: Request) {
  const folderId = new URL(request.url).searchParams.get("folderId")?.trim();
  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const result = await removeExcelDriveFolder(folderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ folders: result.folders });
}

function parseServiceAccountReady() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) return true;
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
}
