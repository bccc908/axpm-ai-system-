import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreSystemBackup } from "@/lib/system/backup";

const bodySchema = z.object({
  backup: z.object({
    version: z.literal(1),
    app: z.literal("axpm-ai-system"),
    created_at: z.string().optional(),
    files: z.record(z.string(), z.unknown()),
  }),
  confirm: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await restoreSystemBackup(parsed.data.backup, {
      createPreRestoreBackup: true,
    });

    return NextResponse.json({
      ok: true,
      restored: result.restored,
      count: result.count,
    });
  } catch (error) {
    console.error("[System restore POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed" },
      { status: 500 },
    );
  }
}
