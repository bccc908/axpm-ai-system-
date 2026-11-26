import { readFileSync, readdirSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FoundingPage, { metadata } from "@/app/founding/page";
import robots from "@/app/robots";
import nextConfigFactory from "../../../next.config";
import { RichText } from "@/components/founding/rich";
import { COPY, unresolvedCopyItems } from "./copy";
import { SELLER_ENV, SELLER_KEYS, missingSellerKeys, sellerValue, waitlistGate } from "./config";
import { formState, handleFoundingSubmission, isMainlandChina } from "./submission";
import { getFoundingWaitlistStore } from "./store";
import { PLACEHOLDER_MARKERS, findPlaceholderMarkers } from "./placeholder-gate";
import { PLACEHOLDER_MARKERS as SCRIPT_MARKERS } from "../../../scripts/placeholder-markers.mjs";

const ROOT = process.cwd();
const FOUNDING_FILES = [
  "src/app/founding/page.tsx",
  "src/app/founding/waitlist-form.tsx",
  "src/app/founding/actions.ts",
  "src/components/founding/rich.tsx",
  ...readdirSync(path.join(ROOT, "src/lib/founding"))
    .filter((f) => !f.endsWith(".test.ts"))
    .map((f) => `src/lib/founding/${f}`),
];

const FILLED_ENV: Record<string, string> = {
  FOUNDING_WAITLIST_OPEN: "true",
  FOUNDING_CW1_CLEARED: "true",
  FOUNDING_SELLER_LEGAL_NAME: "Example Sdn Bhd",
  FOUNDING_SELLER_REG_NO: "202601000001",
  FOUNDING_SELLER_ADDRESS: "1 Example Street, Kuala Lumpur",
  FOUNDING_SUPPORT_EMAIL: "support@example.com",
  FOUNDING_PRIVACY_URL: "https://example.com/privacy",
  FOUNDING_TERMS_URL: "https://example.com/terms",
};

async function renderPage(lang?: string) {
  const el = await FoundingPage({ searchParams: Promise.resolve(lang ? { lang } : {}) });
  return renderToStaticMarkup(el);
}

const savedEnv = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(FILLED_ENV)) delete process.env[k];
});
afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("founding waitlist stores nothing (preview)", () => {
  it("flag defaults OFF and the gate is closed", () => {
    expect(waitlistGate({}).open).toBe(false);
    expect(waitlistGate({}).reasons[0]).toMatch(/default OFF/);
  });

  it("stays closed even with the flag ON and every seller value filled (no store, copy unresolved)", () => {
    const gate = waitlistGate(FILLED_ENV);
    expect(gate.open).toBe(false);
    expect(gate.reasons.join(" ")).toMatch(/no separate waitlist store/);
    expect(getFoundingWaitlistStore()).toBeNull();
  });

  it("the server handler does not read a single field and logs nothing", async () => {
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    const get = vi.fn(() => "MY");
    for (const env of [{}, FILLED_ENV]) {
      await expect(handleFoundingSubmission({ get }, env)).resolves.toEqual({ status: "not_open" });
    }
    expect(get).not.toHaveBeenCalled();
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
  });

  it("founding code has no storage, email, network, payment or logging calls", () => {
    const banned = [
      /from\s+["'](fs|node:fs|fs\/promises)["']/,
      /users\.json|users-store|@\/lib\/auth\/users/,
      /supabase|prisma|@\/lib\/db|sqlite|postgres/i,
      /resend|nodemailer|sendMail|@\/lib\/email/i,
      /console\.(log|info|warn|error|debug)/,
      /\bfetch\(/,
      /stripe/i,
      /analytics|gtag|posthog/i,
    ];
    for (const file of FOUNDING_FILES) {
      // Comments may name the forbidden stores (documentation); code may not use them.
      const src = readFileSync(path.join(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const re of banned) expect(src, `${file} ${re}`).not.toMatch(re);
    }
  });

  it("the form has no card, deposit or payment field and the owner field is country only", async () => {
    const html = await renderPage();
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.filter((n) => /card|deposit|stripe|payment|iban|passport|ic_?no/i.test(n))).toEqual([]);
    expect(names.filter((n) => /owner/i.test(n))).toEqual(["ownerCountry"]);
    expect(html).toMatch(/<select[^>]*name="ownerCountry"/);
    expect(html).toContain('data-state="preview"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    expect(html).toContain('data-testid="preview-banner"');
  });
});

describe("mainland China path", () => {
  it("is detected and always closed, whatever the gate", () => {
    expect(isMainlandChina("CN")).toBe(true);
    expect(isMainlandChina(" cn ")).toBe(true);
    expect(isMainlandChina("HK")).toBe(false);
    expect(formState({ collectionOpen: true, workCountry: "CN" })).toBe("region_closed");
    expect(formState({ collectionOpen: false, workCountry: "CN" })).toBe("region_closed");
    expect(formState({ collectionOpen: false, workCountry: "MY" })).toBe("preview");
    expect(formState({ collectionOpen: true, workCountry: "MY" })).toBe("ready");
  });

  it("uses the exact Compliance fix 1 message in both languages", () => {
    expect(COPY.form.mainland.en).toBe("Sign-ups from your region aren't open yet. We haven't saved your details.");
    expect(COPY.form.mainland.zh).toBe("您所在地区暂未开放报名，我们没有保存您的信息。");
  });

  it("the client returns before any server call unless the state is ready", () => {
    const src = readFileSync(path.join(ROOT, "src/app/founding/waitlist-form.tsx"), "utf8");
    const before = src.slice(0, src.indexOf("submitFoundingWaitlist(new FormData"));
    expect(before).toMatch(/if \(state !== "ready"\) \{[\s\S]*return;/);
  });
});

describe("noindex", () => {
  it("page metadata is noindex/nofollow", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("X-Robots-Tag noindex covers /founding", async () => {
    const cfg = nextConfigFactory("phase-test");
    const rules = await cfg.headers!();
    const rule = rules.find((r) => r.source === "/:path*");
    expect(rule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
  });

  it("robots.txt disallows everything including /founding", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(["/", "/founding"]));
  });
});

describe("strict placeholder gate", () => {
  it("CI script markers match the app markers", () => {
    expect(SCRIPT_MARKERS.map((m: { name: string; re: RegExp }) => [m.name, String(m.re)])).toEqual(
      PLACEHOLDER_MARKERS.map((m) => [m.name, String(m.re)]),
    );
  });

  it("detects every marker", () => {
    for (const sample of ['<span class="ph">x</span>', "[TBD]", "[URL]", "[Year]", "【待定】", "待确认", "TODO-COPY", "Lorem ipsum", "{{SELLER_LEGAL_NAME}}"]) {
      expect(findPlaceholderMarkers(sample), sample).not.toEqual([]);
    }
    expect(findPlaceholderMarkers("<p>Kayden Chiew CRM</p>")).toEqual([]);
  });

  it("the page REFUSES to pass today (seller + copy placeholders), in EN and 中文", async () => {
    for (const lang of [undefined, "zh"]) {
      const hits = findPlaceholderMarkers(await renderPage(lang));
      expect(hits).toContain('class="ph"');
      expect(hits).toContain("{{PLACEHOLDER}}");
    }
    expect(unresolvedCopyItems().length).toBeGreaterThan(0);
  });

  it("seller placeholders clear only with real values", () => {
    expect(missingSellerKeys({})).toEqual([...SELLER_KEYS]);
    expect(sellerValue("SELLER_LEGAL_NAME", { FOUNDING_SELLER_LEGAL_NAME: "{{SELLER_LEGAL_NAME}}" })).toBeNull();
    expect(sellerValue("SELLER_LEGAL_NAME", { FOUNDING_SELLER_LEGAL_NAME: "[TBD]" })).toBeNull();
    expect(missingSellerKeys(FILLED_ENV)).toEqual([]);
    const seller = Object.fromEntries(SELLER_KEYS.map((k) => [k, FILLED_ENV[SELLER_ENV[k]]])) as never;
    const footer = renderToStaticMarkup(createElement(RichText, { rich: COPY.footer.en, seller, locale: "en" }));
    expect(findPlaceholderMarkers(footer)).toEqual([]);
    const empty = Object.fromEntries(SELLER_KEYS.map((k) => [k, null])) as never;
    const footerEmpty = renderToStaticMarkup(createElement(RichText, { rich: COPY.footer.zh, seller: empty, locale: "zh" }));
    expect(findPlaceholderMarkers(footerEmpty)).toEqual(['class="ph"', "{{PLACEHOLDER}}"]);
  });

  it("build preflight fails with the flag ON and unresolved placeholders, passes with it OFF", () => {
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["scripts/founding-preflight.mjs"], { cwd: ROOT, env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
    expect(run({}).status).toBe(0);
    const on = run({ FOUNDING_WAITLIST_OPEN: "true" });
    expect(on.status).toBe(1);
    expect(on.stderr).toMatch(/FOUNDING_SELLER_LEGAL_NAME is not filled/);
    const filled = run(FILLED_ENV);
    expect(filled.status).toBe(1);
    expect(filled.stderr).toMatch(/unresolved ph/);
  });
});

describe("branding and languages", () => {
  it("0 internal brand in rendered EN/中文 HTML and founding sources", async () => {
    for (const lang of [undefined, "zh"]) {
      const html = await renderPage(lang);
      expect(html).not.toMatch(/axpm/i);
      expect(html).toContain("Kayden Chiew");
    }
    for (const file of FOUNDING_FILES) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).not.toMatch(/axpm/i);
    }
  });

  it("renders English and 中文, the v4 F4 footnote, and no Malay UI copy", async () => {
    const en = await renderPage();
    const zh = await renderPage("zh");
    expect(en).toContain("Kayden Chiew CRM for IB teams");
    expect(en).toContain("AI drafts aren&#x27;t included for teams based in, or owned or controlled from, mainland China, Hong Kong or Macau.");
    expect(zh).toContain("Kayden Chiew CRM，为 IB 团队打造");
    expect(zh).toContain("创始价不变");
    expect(zh).toContain('lang="zh-CN"');
    for (const html of [en, zh]) {
      const text = html.replace(/<[^>]+>/g, " ");
      expect(text).not.toMatch(/\b(anda|kami|percuma|untuk|dengan|daftar|sertai|pasukan)\b/i);
    }
  });
});
