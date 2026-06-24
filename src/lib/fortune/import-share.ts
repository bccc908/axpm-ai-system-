import "server-only";

import type { FortuneReadingImport } from "@/lib/fortune/import-chatgpt";
import {
  messagesToReadings,
  parseChatGptConversation,
  type ParsedChatMessage,
} from "@/lib/fortune/import-chatgpt";

const SHARE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function extractChatGptShareId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(
    /(?:https?:\/\/)?(?:chatgpt\.com|chat\.openai\.com)\/share\/([a-f0-9-]+)/i,
  );
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-f0-9-]{36}$/i.test(trimmed)) return trimmed;
  return null;
}

type ShareMessage = {
  author?: { role?: string };
  content?: { content_type?: string; parts?: unknown[] };
  create_time?: number;
  metadata?: {
    is_visually_hidden_from_conversation?: boolean;
  };
};

function messageFromShareEntry(entry: ShareMessage | undefined): ParsedChatMessage | null {
  if (!entry?.content) return null;
  if (entry.metadata?.is_visually_hidden_from_conversation) return null;

  const role = entry.author?.role;
  if (role !== "user" && role !== "assistant") return null;

  const type = entry.content.content_type ?? "text";
  if (type !== "text" && type !== "multimodal_text" && type !== "code") return null;

  const text = (entry.content.parts ?? [])
    .map((part) => (typeof part === "string" ? part : ""))
    .join("")
    .trim();
  if (!text) return null;

  return {
    role,
    text,
    createTime: entry.create_time ?? null,
  };
}

export function parseChatGptSharePayload(raw: unknown): FortuneReadingImport[] {
  const data = raw as Record<string, unknown>;
  const title =
    (typeof data.title === "string" && data.title.trim()) || "ChatGPT share";

  const messages: ParsedChatMessage[] = [];

  if (Array.isArray(data.linear_conversation)) {
    for (const entry of data.linear_conversation) {
      const node = entry as { message?: ShareMessage };
      const parsed = messageFromShareEntry(node.message);
      if (parsed) messages.push(parsed);
    }
  }

  if (messages.length === 0 && data.mapping && typeof data.mapping === "object") {
    const fromMapping = parseChatGptConversation({
      title,
      mapping: data.mapping as Record<
        string,
        {
          id?: string;
          message?: ShareMessage | null;
          parent?: string | null;
          children?: string[];
        }
      >,
      current_node: typeof data.current_node === "string" ? data.current_node : undefined,
    });
    messages.push(...fromMapping);
  }

  if (messages.length === 0) {
    throw new Error("No readable messages found in share link");
  }

  return messagesToReadings({
    title,
    messages,
    source: "chatgpt",
  });
}

export async function fetchChatGptShareReadings(shareUrlOrId: string) {
  const shareId = extractChatGptShareId(shareUrlOrId);
  if (!shareId) {
    throw new Error("Invalid ChatGPT share link");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(`https://chatgpt.com/backend-api/share/${shareId}`, {
      headers: {
        "User-Agent": SHARE_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Share link not found or expired");
      }
      throw new Error(`ChatGPT returned ${res.status} — check the link is public`);
    }

    const payload = await res.json();
    const readings = parseChatGptSharePayload(payload);
    const title =
      (typeof payload.title === "string" && payload.title.trim()) || "ChatGPT share";

    return { shareId, title, readings };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Timed out reaching ChatGPT — check your internet or try paste import instead",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
