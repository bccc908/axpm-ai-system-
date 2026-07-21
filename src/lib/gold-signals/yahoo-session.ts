import "server-only";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type YahooSession = { cookie: string; crumb: string };

let cached: { session: YahooSession; expires: number } | null = null;

export async function getYahooSession(): Promise<YahooSession | null> {
  if (cached && Date.now() < cached.expires) return cached.session;

  try {
    const boot = await fetch("https://fc.yahoo.com", {
      redirect: "manual",
      headers: { "User-Agent": BROWSER_UA },
    });
    const setCookie = boot.headers.getSetCookie?.() ?? [];
    const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": BROWSER_UA, Cookie: cookie, Accept: "text/plain,*/*" },
    });
    const crumb = (await crumbRes.text()).trim();
    if (!crumbRes.ok || crumb.startsWith("<!") || crumb.length > 32) return null;

    const session = { cookie, crumb };
    cached = { session, expires: Date.now() + 45 * 60_000 };
    return session;
  } catch {
    return null;
  }
}

export function yahooChartHeaders(session: YahooSession): Record<string, string> {
  return {
    "User-Agent": BROWSER_UA,
    Accept: "application/json,text/plain,*/*",
    Cookie: session.cookie,
  };
}

export { BROWSER_UA };
