import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ENV_KEYS = ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", "OPENAI_PROXY", "HTTPS_PROXY", "HTTP_PROXY", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"];
const saved: Record<string, string | undefined> = {};

function okResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("llmChat provider routing", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    vi.resetModules();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    vi.unstubAllGlobals();
  });

  it("uses OpenAI when AI_PROVIDER=openai even if a DeepSeek key exists", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-openai";
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
    const fetchMock = vi.fn(async () => okResponse('{"a":1}'));
    vi.stubGlobal("fetch", fetchMock);
    const { llmChat } = await import("@/lib/ai/deepseek-client");
    const res = await llmChat({ messages: [{ role: "user", content: "hi" }], json: true });
    expect(res).toMatchObject({ ok: true, model: "gpt-4o-mini" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test-openai");
    expect(JSON.parse(String(init.body)).model).toBe("gpt-4o-mini");
  });

  it("uses DeepSeek when AI_PROVIDER=deepseek", async () => {
    process.env.AI_PROVIDER = "deepseek";
    process.env.OPENAI_API_KEY = "sk-test-openai";
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
    const fetchMock = vi.fn(async () => okResponse("hello"));
    vi.stubGlobal("fetch", fetchMock);
    const { llmChat } = await import("@/lib/ai/deepseek-client");
    const res = await llmChat({ messages: [{ role: "user", content: "hi" }] });
    expect(res).toMatchObject({ ok: true, model: "deepseek-chat" });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
  });

  it("reports the missing OpenAI key by name", async () => {
    process.env.AI_PROVIDER = "openai";
    const { llmChat } = await import("@/lib/ai/deepseek-client");
    const res = await llmChat({ messages: [{ role: "user", content: "hi" }] });
    expect(res).toEqual({ ok: false, error: "OPENAI_API_KEY not set in .env.local" });
  });

  it("maps OpenAI insufficient_quota 429 to an insufficient-balance error", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-openai";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "You exceeded your current quota" } }), { status: 429 })));
    const { llmChat } = await import("@/lib/ai/deepseek-client");
    const res = await llmChat({ messages: [{ role: "user", content: "hi" }] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/^Insufficient Balance/);
  });
});
