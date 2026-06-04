import { Readable } from "stream";
import { google } from "googleapis";

export type GoogleDriveConfig = {
  configured: boolean;
  folderIdSet: boolean;
};

export function getGoogleDriveConfig(): GoogleDriveConfig {
  const hasKey = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()),
  );
  const folderIdSet = Boolean(process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim());
  return {
    configured: hasKey && folderIdSet,
    folderIdSet,
  };
}

function parseServiceAccount() {
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

async function getDriveClient() {
  const credentials = parseServiceAccount();
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim();
  if (!credentials || !folderId) {
    return { ok: false as const, error: "Google Drive not configured" };
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });
  return { ok: true as const, drive, folderId };
}

export async function uploadReceiptToGoogleDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ ok: true; fileId: string; webViewLink: string } | { ok: false; error: string }> {
  const client = await getDriveClient();
  if (!client.ok) return client;

  try {
    const { drive, folderId } = client;
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
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
