import { NextResponse } from "next/server";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";
import { createSystemBackup, listBackupFileMeta } from "@/lib/system/backup";

export const dynamic = "force-dynamic";

async function canAccessBackup(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

async function runBackup() {
  const [meta, bundle] = await Promise.all([listBackupFileMeta(), createSystemBackup()]);
  return NextResponse.json({
    ok: true,
    meta,
    backup: bundle,
    downloadName: `axpm-backup-${(bundle.created_at ?? new Date().toISOString()).slice(0, 10)}.json`,
  });
}

export async function GET(request: Request) {
  if (!(await canAccessBackup(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runBackup();
  } catch (error) {
    console.error("[System backup GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await canAccessBackup(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runBackup();
  } catch (error) {
    console.error("[System backup POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup failed" },
      { status: 500 },
    );
  }
}
