import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { telegramRetryTiming } from "@/lib/integrations/telegram";
import { POST } from "./route";

const TOKEN = "987654321:AAFakeRouteTokenForTests_zyxwvutsrqpo";
const SECRET = "cron-test-secret";

let fetchMock: ReturnType<typeof vi.fn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let sleepSpy: MockInstance<(ms: number) => Promise<void>>;

function req() {
  return new Request("http://127.0.0.1:3000/api/signals/approvals/poll", {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}` },
  });
}
function logged() {
  return errSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
}

beforeEach(() => {
  vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(path.join(tmpdir(), "poll-")));
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.CRON_SECRET = SECRET;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  // The retry wait resolves at once (no clock involved), so real file I/O in the route cannot race it.
  sleepSpy = vi.spyOn(telegramRetryTiming, "sleep").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

async function call() {
  const res = await POST(req());
  return { res, body: await res.json() };
}

describe("POST /api/signals/approvals/poll", () => {
  it("logs and returns Telegram's error_code and description on a 409 (one attempt)", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ ok: false, error_code: 409, description: "Conflict: terminated by other getUpdates request" }), {
        status: 409,
      }),
    );
    const { res, body } = await call();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({
      error_code: 409,
      description: "Conflict: terminated by other getUpdates request",
      http_status: 409,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
    expect(logged()).toMatch(/\[approvals\/poll\] getUpdates failed .*"error_code":409/);
    expect(logged()).toContain("Conflict: terminated by other getUpdates request");
  });

  it("retries a Telegram 502 once and reports both attempts", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ ok: false, error_code: 502, description: "Bad Gateway" }), { status: 502 }),
    );
    const { res, body } = await call();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ error_code: 502, description: "Bad Gateway", attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy.mock.calls).toEqual([[2_000]]); // one ~2s wait between the two attempts
  });

  it("never puts the bot token in the log or the response", async () => {
    fetchMock.mockRejectedValue(new TypeError(`connect ETIMEDOUT https://api.telegram.org/bot${TOKEN}/getUpdates`));
    const { res, body } = await call();
    expect(res.status).toBe(502);
    expect(body.error_code).toBeNull();
    const out = JSON.stringify(body) + logged();
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(TOKEN.split(":")[1]);
    expect(out).toContain("bot<redacted>");
  });

  it("still refuses without CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
