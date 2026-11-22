import { Readable } from "stream";
import { google } from "googleapis";
import { getExcelDriveFolders } from "@/lib/integrations/google-drive-folders";

const EXCEL_MIME = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.google-apps.spreadsheet",
] as const;

export type GoogleDriveConfig = {
  configured: boolean;
  folderIdSet: boolean;
  excelConfigured: boolean;
  excelFolderIdSet: boolean;
  excelFolderCount: number;
  serviceAccountEmail: string | null;
};

export type DriveExcelFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
  kind: "excel" | "google-sheet";
  folderId: string;
};

export function parseServiceAccount() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      return JSON.parse(json) as { client_email: string; private_key: string };
    } catch {
      return null;
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()?.replace(/\\n/g, "\n");
  if (email && key) {
    return { client_email: email, private_key: key };
  }
  return null;
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  const credentials = parseServiceAccount();
  const hasKey = Boolean(credentials);
  const folderIdSet = Boolean(process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim());
  const hasExcelEnv = Boolean(
    process.env.GOOGLE_DRIVE_EXCEL_FOLDER_ID?.trim() ||
      process.env.GOOGLE_DRIVE_EXCEL_FOLDER_IDS?.trim() ||
      process.env.GOOGLE_DRIVE_EXCEL_FOLDERS?.trim(),
  );
  return {
    configured: hasKey && folderIdSet,
    folderIdSet,
    excelConfigured: hasKey && hasExcelEnv,
    excelFolderIdSet: hasExcelEnv,
    excelFolderCount: 0,
    serviceAccountEmail: credentials?.client_email ?? null,
  };
}

export async function getGoogleDriveConfigAsync(): Promise<GoogleDriveConfig> {
  const base = getGoogleDriveConfig();
  const folders = await getExcelDriveFolders();
  const credentials = parseServiceAccount();
  const hasKey = Boolean(credentials);
  return {
    ...base,
    excelConfigured: hasKey && folders.length > 0,
    excelFolderIdSet: folders.length > 0,
    excelFolderCount: folders.length,
  };
}

async function getDriveClient(scopes: string[], folderId?: string) {
  const credentials = parseServiceAccount();
  if (!credentials) {
    return { ok: false as const, error: "Google service account not configured" };
  }
  if (folderId !== undefined && !folderId) {
    return { ok: false as const, error: "Google Drive folder ID not configured" };
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes });
  const drive = google.drive({ version: "v3", auth });
  return { ok: true as const, drive, folderId: folderId ?? "" };
}

function excelKind(mimeType: string): DriveExcelFile["kind"] {
  return mimeType === "application/vnd.google-apps.spreadsheet" ? "google-sheet" : "excel";
}

export async function listExcelFilesInFolder(
  folderId: string,
): Promise<{ ok: true; files: DriveExcelFile[] } | { ok: false; error: string }> {
  if (!folderId) {
    return { ok: false, error: "Folder ID required" };
  }

  const client = await getDriveClient(
    ["https://www.googleapis.com/auth/drive.readonly"],
    folderId,
  );
  if (!client.ok) return client;

  try {
    const mimeQuery = EXCEL_MIME.map((m) => `mimeType='${m}'`).join(" or ");
    const res = await client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (${mimeQuery})`,
      fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files: DriveExcelFile[] = (res.data.files ?? [])
      .filter((f) => f.id && f.name && f.mimeType)
      .map((f) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        modifiedTime: f.modifiedTime ?? null,
        size: f.size ? Number(f.size) : null,
        webViewLink: f.webViewLink ?? null,
        kind: excelKind(f.mimeType!),
        folderId,
      }));

    return { ok: true, files };
  } catch (error) {
    console.error("[Google Drive list]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to list Drive files",
    };
  }
}

export async function downloadDriveExcelFile(
  fileId: string,
  mimeType: string,
): Promise<{ ok: true; buffer: Buffer; fileName: string } | { ok: false; error: string }> {
  const client = await getDriveClient(["https://www.googleapis.com/auth/drive.readonly"]);
  if (!client.ok) return client;

  try {
    const meta = await client.drive.files.get({
      fileId,
      fields: "name,mimeType",
      supportsAllDrives: true,
    });
    const name = meta.data.name ?? "workbook.xlsx";
    const type = meta.data.mimeType ?? mimeType;

    if (type === "application/vnd.google-apps.spreadsheet") {
      const res = await client.drive.files.export(
        {
          fileId,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        { responseType: "arraybuffer" },
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      const fileName = name.endsWith(".xlsx") ? name : `${name}.xlsx`;
      return { ok: true, buffer, fileName };
    }

    const res = await client.drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    return { ok: true, buffer: Buffer.from(res.data as ArrayBuffer), fileName: name };
  } catch (error) {
    console.error("[Google Drive download]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to download file",
    };
  }
}

export async function uploadReceiptToGoogleDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ ok: true; fileId: string; webViewLink: string } | { ok: false; error: string }> {
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim();
  const client = await getDriveClient(
    ["https://www.googleapis.com/auth/drive.file"],
    folderId,
  );
  if (!client.ok) return client;

  try {
    const { drive } = client;
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId!],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id, webViewLink",
    });

    const fileId = res.data.id;
    if (!fileId) {
      return { ok: false, error: "Drive upload returned no file ID" };
    }

    return {
      ok: true,
      fileId,
      webViewLink: res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    };
  } catch (error) {
    console.error("[Google Drive upload]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Drive upload failed",
    };
  }
}

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,}$/;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SKIPPED_KNOWLEDGE_MIMES = new Set([
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.form",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.shortcut",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type DriveChild = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
  isFolder: boolean;
};

export function isGoogleServiceAccountConfigured(): boolean {
  return Boolean(parseServiceAccount());
}

export function googleServiceAccountEmail(): string | null {
  return parseServiceAccount()?.client_email ?? null;
}

export function isSkippedKnowledgeDriveMime(mimeType: string): boolean {
  return SKIPPED_KNOWLEDGE_MIMES.has(mimeType);
}

function driveId(value: string): string | null {
  const id = value.trim();
  return DRIVE_ID.test(id) ? id : null;
}

/** One folder level. Used by the knowledge library; the Excel page keeps its own listing. */
export async function listDriveChildren(
  folderId: string,
): Promise<{ ok: true; files: DriveChild[] } | { ok: false; error: string }> {
  const folder = driveId(folderId);
  if (!folder) return { ok: false, error: "Invalid Google Drive folder" };
  const client = await getDriveClient(["https://www.googleapis.com/auth/drive.readonly"], folder);
  if (!client.ok) return client;

  const files: DriveChild[] = [];
  let pageToken: string | undefined;
  try {
    for (let page = 0; page < 4; page += 1) {
      const res = await client.drive.files.list({
        q: `'${folder}' in parents and trashed=false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
        pageSize: 100,
        pageToken,
        orderBy: "modifiedTime desc",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const file of res.data.files ?? []) {
        if (!file.id || !file.name || !file.mimeType) continue;
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime ?? null,
          size: file.size ? Number(file.size) : null,
          webViewLink: file.webViewLink ?? null,
          isFolder: file.mimeType === FOLDER_MIME,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }
    return { ok: true, files };
  } catch (error) {
    console.error("[Google Drive knowledge list]", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to list Drive files" };
  }
}

async function fileIsInsideLibrary(
  drive: Awaited<ReturnType<typeof getDriveClient>> & { ok: true },
  parents: string[],
  rootFolderId: string,
): Promise<boolean> {
  if (parents.includes(rootFolderId)) return true;
  for (const parent of parents) {
    if (!driveId(parent)) continue;
    const folder = await drive.drive.files.get({
      fileId: parent,
      fields: "parents",
      supportsAllDrives: true,
    });
    if ((folder.data.parents ?? []).includes(rootFolderId)) return true;
  }
  return false;
}

export async function readDriveLibraryFile(
  fileId: string,
  rootFolderId: string,
): Promise<
  | { ok: true; name: string; mimeType: string; buffer: Buffer; webViewLink: string; text: string | null }
  | { ok: false; error: string }
> {
  const id = driveId(fileId);
  const root = driveId(rootFolderId);
  if (!id || !root) return { ok: false, error: "Invalid Google Drive file" };
  const client = await getDriveClient(["https://www.googleapis.com/auth/drive.readonly"]);
  if (!client.ok) return client;

  try {
    const meta = await client.drive.files.get({
      fileId: id,
      fields: "id,name,mimeType,parents,size,webViewLink",
      supportsAllDrives: true,
    });
    const parents = (meta.data.parents ?? []).filter((parent): parent is string => Boolean(parent));
    const allowed = await fileIsInsideLibrary(client, parents, root);
    if (!allowed) return { ok: false, error: "That file is outside the staff library folder" };
    const name = meta.data.name ?? "document";
    const mimeType = meta.data.mimeType ?? "application/octet-stream";
    if (mimeType === FOLDER_MIME || isSkippedKnowledgeDriveMime(mimeType)) {
      return { ok: false, error: "Spreadsheets stay on the Google Drive Excel page" };
    }
    const size = meta.data.size ? Number(meta.data.size) : null;
    if (size != null && size > 12 * 1024 * 1024) return { ok: false, error: "File is too large" };
    const webViewLink = meta.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view`;

    if (mimeType === "application/vnd.google-apps.document") {
      const res = await client.drive.files.export(
        { fileId: id, mimeType: "text/plain" },
        { responseType: "arraybuffer" },
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      if (buffer.length > 12 * 1024 * 1024) return { ok: false, error: "File is too large" };
      return { ok: true, name, mimeType: "text/plain", buffer, webViewLink, text: buffer.toString("utf8") };
    }

    const res = await client.drive.files.get(
      { fileId: id, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    if (buffer.length > 12 * 1024 * 1024) return { ok: false, error: "File is too large" };
    return { ok: true, buffer, name, mimeType, webViewLink, text: null };
  } catch (error) {
    console.error("[Google Drive knowledge download]", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to download file" };
  }
}
