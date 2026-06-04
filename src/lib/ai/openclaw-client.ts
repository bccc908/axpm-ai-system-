import "server-only";
import {
  getOpenClawGatewayToken,
  getOpenClawGatewayURL,
  getOpenClawModel,
  isOpenClawConfigured,
} from "@/lib/ai/openclaw-config";

export type OpenClawMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function openClawChatCompletion(params: {
  messages: OpenClawMessage[];
  user?: string;
  model?: string;
  timeoutMs?: number;
}): Promise<{ content: string } | null> {
  if (!isOpenClawConfigured()) return null;

  const base = getOpenClawGatewayURL().replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 90_000);

  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenClawGatewayToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? getOpenClawModel(),
        user: params.user,
        messages: params.messages,
        temperature: 0.45,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[OpenClaw]", res.status, text.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? { content } : null;
  } catch (error) {
    console.error("[OpenClaw]", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
