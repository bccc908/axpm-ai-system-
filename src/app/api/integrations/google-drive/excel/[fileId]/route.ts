import { NextResponse } from "next/server";
import { z } from "zod";
import { computeCommissionSplit } from "@/lib/integrations/commission-split";
import { downloadDriveExcelFile } from "@/lib/integrations/google-drive";
import { parseExcelBuffer } from "@/lib/integrations/excel-parse";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  sheet: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  defaultRate: z.coerce.number().min(0).max(100).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    sheet: url.searchParams.get("sheet") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    defaultRate: url.searchParams.get("defaultRate") ?? undefined,
  });
  const sheetName = parsed.success ? parsed.data.sheet : undefined;
  const limit = parsed.success ? parsed.data.limit : undefined;
  const defaultRate = parsed.success ? parsed.data.defaultRate : undefined;

  const mimeType = url.searchParams.get("mimeType") ?? "";
  const downloaded = await downloadDriveExcelFile(fileId, mimeType);
  if (!downloaded.ok) {
    return NextResponse.json({ error: downloaded.error }, { status: 502 });
  }

  const workbook = parseExcelBuffer(downloaded.buffer, downloaded.fileName);
  const sheets = sheetName
    ? workbook.sheets.filter((s) => s.name === sheetName)
    : workbook.sheets;

  const primary = sheets[0];
  const commission = primary
    ? computeCommissionSplit(primary, { defaultRate })
    : null;

  return NextResponse.json({
    fileId,
    fileName: downloaded.fileName,
    sheetNames: workbook.sheetNames,
    sheets: sheets.map((s) => ({
      ...s,
      rows: limit ? s.rows.slice(0, limit) : s.rows,
      previewLimit: limit ?? null,
    })),
    commission,
  });
}
