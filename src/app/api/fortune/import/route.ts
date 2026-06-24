import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseChatGptExport,
  parseLooseChatPaste,
  parseReadingsJson,
  previewImportSummary,
} from "@/lib/fortune/import-chatgpt";
import { fetchChatGptShareReadings } from "@/lib/fortune/import-share";
import { fortuneScopeForRole, importScopedFortuneReadings } from "@/lib/fortune/context";
import { getServerSession } from "@/lib/auth/api-session";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const jsonSchema = z.object({
  mode: z.enum(["chatgpt-json", "paste", "readings-json", "share-url"]),
  text: z.string().min(1).max(20_000_000).optional(),
  shareUrl: z.string().max(500).optional(),
  titleFilter: z.string().max(500).optional(),
  onlyFortune: z.boolean().optional(),
  preview: z.boolean().optional(),
  title: z.string().max(120).optional(),
});

function parseImportPayload(raw: unknown, options: {
  mode: "chatgpt-json" | "paste" | "readings-json";
  titleFilter?: string;
  onlyFortune?: boolean;
  title?: string;
}) {
  if (options.mode === "paste") {
    return parseLooseChatPaste(String(raw), options.title ?? "Imported chat");
  }
  if (options.mode === "readings-json") {
    return parseReadingsJson(typeof raw === "string" ? JSON.parse(raw) : raw);
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parseChatGptExport(parsed, {
    titleFilter: options.titleFilter,
    onlyFortune: options.onlyFortune,
  });
}

export async function POST(request: Request) {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const mode = String(form.get("mode") ?? "chatgpt-json");
      const titleFilter = String(form.get("titleFilter") ?? "").trim() || undefined;
      const onlyFortune = form.get("onlyFortune") === "true";
      const preview = form.get("preview") === "true";

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      if (mode !== "chatgpt-json") {
        return NextResponse.json({ error: "File upload supports chatgpt-json only" }, { status: 400 });
      }

      const text = await file.text();
      const parsedJson = JSON.parse(text);
      const readings = parseChatGptExport(parsedJson, { titleFilter, onlyFortune });
      const summary = previewImportSummary(readings);

      if (preview) {
        return NextResponse.json({ preview: true, ...summary });
      }

      const result = await importScopedFortuneReadings(scope, readings);
      return NextResponse.json({ preview: false, ...summary, ...result });
    }

    const body = await request.json();
    const parsed = jsonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.mode === "share-url") {
      const shareUrl = parsed.data.shareUrl?.trim();
      if (!shareUrl) {
        return NextResponse.json({ error: "Missing shareUrl" }, { status: 400 });
      }
      const fetched = await fetchChatGptShareReadings(shareUrl);
      const summary = previewImportSummary(fetched.readings);
      if (parsed.data.preview) {
        return NextResponse.json({
          preview: true,
          shareTitle: fetched.title,
          ...summary,
        });
      }
      const result = await importScopedFortuneReadings(scope, fetched.readings);
      return NextResponse.json({
        preview: false,
        shareTitle: fetched.title,
        ...summary,
        ...result,
      });
    }

    if (!parsed.data.text?.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const readings = parseImportPayload(parsed.data.text, {
      mode: parsed.data.mode,
      titleFilter: parsed.data.titleFilter,
      onlyFortune: parsed.data.onlyFortune,
      title: parsed.data.title,
    });
    const summary = previewImportSummary(readings);

    if (parsed.data.preview) {
      return NextResponse.json({ preview: true, ...summary });
    }

    const result = await importScopedFortuneReadings(scope, readings);
    return NextResponse.json({ preview: false, ...summary, ...result });
  } catch (error) {
    console.error("[Fortune import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
