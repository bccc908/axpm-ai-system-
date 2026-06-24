import { NextResponse } from "next/server";
import { listBackupFileMeta } from "@/lib/system/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const meta = await listBackupFileMeta();
  const totalBytes = meta.reduce((sum, f) => sum + f.bytes, 0);
  const existing = meta.filter((f) => f.exists).length;
  return NextResponse.json({ meta, totalBytes, fileCount: existing });
}
