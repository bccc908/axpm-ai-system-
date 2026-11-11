import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { createSystemBackup, listBackupFileMeta } from "@/lib/system/backup";

export const dynamic = "force-dynamic";

function hasCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function canAccessBackup(request: Request) {
  if (hasCronSecret(request)) return true;
  const ctx = await getServerSession();
  return Boolean(ctx);
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
