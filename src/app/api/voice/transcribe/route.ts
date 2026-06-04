import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/ai/transcribe";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const language = form.get("language");

    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const lang = language === "zh" ? "zh" : language === "en" ? "en" : undefined;
    const result = await transcribeAudio(buffer, "recording.webm", lang);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error("[Voice Transcribe]", error);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
