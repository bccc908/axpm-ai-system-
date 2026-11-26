import { existsSync, readFileSync } from "fs";
import path from "path";
import vm from "vm";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { isPwaIconFile } from "@/lib/pwa/icons";
import { detectPlatformHint, hintKeyFor, INSTALL_DISMISS_DAYS, isDismissed } from "@/lib/pwa/install-prompt";
import { en } from "@/lib/i18n/locales/en";
import { zh } from "@/lib/i18n/locales/zh";

const root = process.cwd();
const INTERNAL = new RegExp(["a", "x", "p", "m"].join(""), "i");

type SwModule = {
  classify: (request: { method: string; url: string; mode?: string }, origin: string) => string;
  PRECACHE: string[];
  OFFLINE_URL: string;
};

function loadSw(): SwModule {
  const source = readFileSync(path.join(root, "public/sw.js"), "utf8");
  const mod = { exports: {} as SwModule };
  const sandbox = { module: mod, self: { addEventListener: () => {}, location: { origin: "https://app.kaydenchiew.com" } }, URL };
  vm.runInNewContext(source, sandbox);
  return mod.exports;
}

describe("PWA manifest", () => {
  const m = manifest();

  it("is branded Kayden Chiew with no internal brand", () => {
    expect(m.name).toBe("Kayden Chiew");
    expect(m.short_name).toBe("Kayden Chiew");
    expect(JSON.stringify(m)).not.toMatch(INTERNAL);
  });

  it("is installable: standalone, start_url in scope, 192/512 any + maskable icons that exist", () => {
    expect(m.display).toBe("standalone");
    expect(String(m.start_url).startsWith("/")).toBe(true);
    const icons = m.icons ?? [];
    for (const size of ["192x192", "512x512"]) {
      expect(icons.some((i) => i.sizes === size && i.purpose === "any")).toBe(true);
      expect(icons.some((i) => i.sizes === size && i.purpose === "maskable")).toBe(true);
    }
    for (const icon of icons) {
      expect(icon.src.startsWith("/icons/"), icon.src).toBe(true);
      expect(isPwaIconFile(icon.src.replace("/icons/", "")), icon.src).toBe(true);
    }
    expect(existsSync(path.join(root, "src/app/apple-touch-icon.png/route.tsx"))).toBe(true);
  });
});

describe("service worker caching rules", () => {
  const sw = loadSw();
  const origin = "https://app.kaydenchiew.com";
  const req = (p: string, extra: Partial<{ method: string; mode: string }> = {}) => ({
    method: "GET",
    url: `${origin}${p}`,
    mode: "no-cors",
    ...extra,
  });

  it("never touches API responses, any method", () => {
    expect(sw.classify(req("/api/auth/me"), origin)).toBe("bypass");
    expect(sw.classify(req("/api/account"), origin)).toBe("bypass");
    expect(sw.classify(req("/api/auth/login", { method: "POST" }), origin)).toBe("bypass");
    expect(sw.classify(req("/api/account", { mode: "navigate" }), origin)).toBe("bypass");
  });

  it("treats pages as network-first navigations (HTML is never stored)", () => {
    expect(sw.classify(req("/dashboard", { mode: "navigate" }), origin)).toBe("page");
    expect(sw.classify(req("/dashboard/account", { mode: "navigate" }), origin)).toBe("page");
    // An RSC/data fetch of a page is not a navigation and is not cached either.
    expect(sw.classify(req("/dashboard/account?_rsc=abc"), origin)).toBe("bypass");
    const source = readFileSync(path.join(root, "public/sw.js"), "utf8");
    const pageFn = source.slice(source.indexOf("async function pageResponse"), source.indexOf("async function staticResponse"));
    expect(pageFn).not.toMatch(/cache\.put/);
  });

  it("caches only static assets, and ignores other origins", () => {
    expect(sw.classify(req("/_next/static/chunks/app.js"), origin)).toBe("static");
    expect(sw.classify(req("/icons/icon-192.png"), origin)).toBe("static");
    expect(sw.classify(req("/_next/image?url=x"), origin)).toBe("bypass");
    expect(sw.classify({ method: "GET", url: "https://cdn.example.com/a.js", mode: "no-cors" }, origin)).toBe("bypass");
  });

  it("precaches only the public offline page and icons", () => {
    expect(sw.OFFLINE_URL).toBe("/offline.html");
    for (const url of sw.PRECACHE) {
      expect(url === "/offline.html" || url.startsWith("/icons/") || url === "/apple-touch-icon.png").toBe(true);
    }
  });
});

describe("offline page", () => {
  const html = readFileSync(path.join(root, "public/offline.html"), "utf8");
  it("is bilingual EN + 中文, static, and brand-clean", () => {
    expect(html).toContain("You're offline");
    expect(html).toContain("当前没有网络");
    expect(html).toContain("Kayden Chiew");
    expect(html).not.toMatch(INTERNAL);
    expect(html).not.toMatch(/<script/i);
  });
});

describe("install prompt", () => {
  it("detects platforms", () => {
    expect(detectPlatformHint("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe("ios");
    expect(detectPlatformHint("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36")).toBe("android");
    expect(hintKeyFor("ios")).toBe("app.installIosHint");
  });

  it("respects a 14-day 'Not now'", () => {
    const now = 1_800_000_000_000;
    expect(isDismissed(null, now)).toBe(false);
    expect(isDismissed(String(now - 86_400_000), now)).toBe(true);
    expect(isDismissed(String(now - (INSTALL_DISMISS_DAYS + 1) * 86_400_000), now)).toBe(false);
    expect(isDismissed("garbage", now)).toBe(false);
  });

  it("has EN and 中文 copy with no internal brand", () => {
    for (const locale of [en, zh] as const) {
      const app = (locale as unknown as { app: Record<string, string> }).app;
      for (const key of ["installTitle", "installDesc", "installBtn", "installLater", "installIosHint", "installAndroidHint"]) {
        expect(app[key], key).toBeTruthy();
        expect(app[key]).not.toMatch(INTERNAL);
      }
    }
  });
});
