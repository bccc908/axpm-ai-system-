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
