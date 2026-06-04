import { NextResponse } from "next/server";
import { getThreads, listMessages } from "@/lib/conversations/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const channel = url.searchParams.get("channel") ?? undefined;
  const limit = url.searchParams.get("limit");

  const [messages, threads] = await Promise.all([
    listMessages({
      client_id: clientId ?? undefined,
      channel: channel as "wechat" | undefined,
      limit: limit ? Number(limit) : undefined,
    }),
    getThreads(),
  ]);

  return NextResponse.json({ messages, threads });
}
