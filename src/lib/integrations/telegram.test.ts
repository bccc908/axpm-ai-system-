import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redactTelegramSecrets, telegramRequest } from "./telegram";

const TOKEN = "123456789:AAFakeTokenForTestsOnly_abcdefghijklmno";

function reply(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Run a request while advancing fake timers so retry sleeps finish. */
async function run<T>(p: Promise<T>) {
  await vi.runAllTimersAsync();
  return p;
}

describe("telegramRequest", () => {
  it("surfaces Telegram's error_code and description on a non-ok reply", async () => {
    fetchMock.mockImplementation(async () => reply(400, { ok: false, error_code: 400, description: "Bad Request: chat not found" }));
    const r = await run(telegramRequest("getUpdates", { limit: 1 }));
    expect(r).toMatchObject({
      ok: false,
      error: "Bad Request: chat not found",
      error_code: 400,
      description: "Bad Request: chat not found",
      http_status: 400,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // other 4xx: no retry
  });

  it("uses a 10s abort signal on every call", async () => {
    fetchMock.mockImplementation(async () => reply(200, { ok: true, result: [] }));
    await run(telegramRequest("getUpdates", {}));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries once after ~2s on 502, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(502, { ok: false, error_code: 502, description: "Bad Gateway" }))
      .mockResolvedValueOnce(reply(200, { ok: true, result: [{ update_id: 1 }] }));
    const p = telegramRequest("getUpdates", {});
    await vi.advanceTimersByTimeAsync(1_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toEqual({ ok: true, result: [{ update_id: 1 }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once on 429, honouring a small retry_after, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        reply(429, { ok: false, error_code: 429, description: "Too Many Requests: retry after 3", parameters: { retry_after: 3 } }),
      )
      .mockResolvedValueOnce(reply(200, { ok: true, result: [] }));
    const p = telegramRequest("getUpdates", {});
    await vi.advanceTimersByTimeAsync(2_500);
    expect(fetchMock).toHaveBeenCalledTimes(1); // waited retry_after (3s), not the default 2s
    await vi.advanceTimersByTimeAsync(600);
    expect(await p).toEqual({ ok: true, result: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caps a large retry_after at 5s", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(429, { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 600 } }))
      .mockResolvedValueOnce(reply(200, { ok: true, result: [] }));
    const p = telegramRequest("getUpdates", {});
    await vi.advanceTimersByTimeAsync(5_001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await p).ok).toBe(true);
  });

  it("gives up after one retry and reports the last error", async () => {
    fetchMock.mockImplementation(async () => reply(502, { ok: false, error_code: 502, description: "Bad Gateway" }));
    const r = await run(telegramRequest("getUpdates", {}));
    expect(r).toMatchObject({ ok: false, error_code: 502, description: "Bad Gateway", attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a 409 conflict", async () => {
    fetchMock.mockResolvedValue(
      reply(409, {
        ok: false,
        error_code: 409,
        description: "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running",
      }),
    );
    const r = await run(telegramRequest("getUpdates", {}));
    expect(r).toMatchObject({ ok: false, error_code: 409, attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("counts a timeout as a retryable network error", async () => {
    fetchMock
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockResolvedValueOnce(reply(200, { ok: true, result: [] }));
    const r = await run(telegramRequest("getUpdates", {}));
    expect(r).toEqual({ ok: true, result: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a timeout on both attempts without an error_code", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "TimeoutError"));
    const r = await run(telegramRequest("getUpdates", {}));
    expect(r).toMatchObject({ ok: false, attempts: 2 });
    expect(r.ok === false && r.error).toMatch(/timed out after 10s/);
    expect(r.ok === false && r.error_code).toBeUndefined();
  });

  it("guards JSON parsing of a non-JSON reply (e.g. an HTML 502 page)", async () => {
    fetchMock.mockImplementation(async () => reply(502, "<html><body>502 Bad Gateway</body></html>"));
    const r = await run(telegramRequest("getUpdates", {}));
    expect(r).toMatchObject({ ok: false, error_code: 502, http_status: 502, attempts: 2 });
    expect(r.ok === false && r.description).toMatch(/^non-JSON reply: <html>/);
  });

  it("does not retry sending methods by default (no duplicate messages)", async () => {
    fetchMock.mockImplementation(async () => reply(502, { ok: false, error_code: 502, description: "Bad Gateway" }));
    const r = await run(telegramRequest("sendMessage", { chat_id: 1, text: "x" }));
    expect(r).toMatchObject({ ok: false, error_code: 502, attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redacts the token from network error messages", async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for https://api.telegram.org/bot${TOKEN}/getUpdates`));
    const r = await run(telegramRequest("getUpdates", {}));
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(r)).not.toContain("AAFakeToken");
    expect(r.ok === false && r.error).toContain("bot<redacted>");
  });
});

describe("redactTelegramSecrets", () => {
  it("removes bot<id>:<secret> URL parts and the raw token", () => {
    expect(redactTelegramSecrets(`x https://api.telegram.org/bot${TOKEN}/getMe y`)).toBe(
      "x https://api.telegram.org/bot<redacted>/getMe y",
    );
    expect(redactTelegramSecrets(`token=${TOKEN}`)).toBe("token=<redacted>");
  });
});
