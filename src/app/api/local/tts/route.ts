import fs from "fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";
import { cleanupLocalSpeech, synthesizeLocalSpeech } from "@/lib/local/local-tts";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().min(1).max(5000),
  format: z.enum(["wav", "mp3"]).optional(),
  engine: z.enum(["auto", "piper", "mac", "edge", "minimax"]).optional(),
});

export async function POST(request: Request) {
  try {
    assertLocalApiAuth(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { wavPath, engine, workDir } = await synthesizeLocalSpeech({
      text: parsed.data.text,
      engine: parsed.data.engine ?? "auto",
    });

    const format = parsed.data.format ?? "wav";
    let outputPath = wavPath;
    let contentType = "audio/wav";

    if (format === "mp3") {
      const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      outputPath = `${workDir}/speech.mp3`;
      await promisify(execFile)(ffmpegInstaller.default.path, ["-y", "-i", wavPath, outputPath]);
      contentType = "audio/mpeg";
    }

    const buffer = await fs.readFile(outputPath);
    await cleanupLocalSpeech(workDir);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="speech.${format}"`,
        "X-TTS-Engine": engine,
      },
    });
  } catch (error) {
    if (error instanceof LocalApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[Local TTS]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TTS failed" },
      { status: 500 },
    );
  }
}
