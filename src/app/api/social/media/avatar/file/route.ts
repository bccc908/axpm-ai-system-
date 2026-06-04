import fs from "fs/promises";
import { NextResponse } from "next/server";
import { getAvatarPath } from "@/lib/social/presenter-avatar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const buffer = await fs.readFile(getAvatarPath());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "No photo uploaded" }, { status: 404 });
  }
}
