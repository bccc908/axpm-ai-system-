import { NextResponse } from "next/server";
import { createSystemBackup, listBackupFileMeta } from "@/lib/system/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [meta, bundle] = await Promise.all([listBackupFileMeta(), createSystemBackup()]);
    return NextResponse.json({
      ok: true,
      meta,
      backup: bundle,
      downloadName: `axpm-backup-${(bundle.created_at ?? new Date().toISOString()).slice(0, 10)}.json`,
    });
  } catch (error) {
    console.error("[System backup GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup failed" },
      { status: 500 },
    );
  }
}
