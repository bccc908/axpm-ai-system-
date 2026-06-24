import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  getSupabaseTableCounts,
  importLocalJsonToSupabase,
  testSupabaseConnection,
} from "@/lib/supabase/import-from-json";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getSupabaseConfig();
  if (!config.canImport) {
    return NextResponse.json({
      config,
      connected: false,
      counts: null,
    });
  }

  try {
    await testSupabaseConnection();
    const counts = await getSupabaseTableCounts();
    return NextResponse.json({ config, connected: true, counts });
  } catch (error) {
    return NextResponse.json({
      config,
      connected: false,
      error: error instanceof Error ? error.message : "Connection failed",
      counts: null,
    });
  }
}

export async function POST(request: Request) {
  const config = getSupabaseConfig();
  if (!config.canImport) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = z.object({ confirm: z.literal(true) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "confirm: true is required" }, { status: 400 });
    }

    const result = await importLocalJsonToSupabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Supabase import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
