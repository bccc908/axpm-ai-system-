import { NextResponse } from "next/server";
import type { Channel } from "@/types/database";
import { getThreads, listMessages } from "@/lib/conversations/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const channelParam = url.searchParams.get("channel");
  const channel = channelParam as Channel | null;
  const limit = url.searchParams.get("limit");

  const [messages, threads] = await Promise.all([
    listMessages({
      client_id: clientId ?? undefined,
      channel: channel ?? undefined,
      limit: limit ? Number(limit) : undefined,
    }),
    getThreads(),
  ]);

  const filteredThreads =
    channel != null ? threads.filter((t) => t.channel === channel) : threads;

  return NextResponse.json({ messages, threads: filteredThreads });
}
