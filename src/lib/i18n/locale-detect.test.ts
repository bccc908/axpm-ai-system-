import { describe, expect, it } from "vitest";
import {
  countryFromHeaders,
  detectLocaleFromHeaders,
  isMainlandChina,
  localeFromCountry,
  resolveLocale,
  storesLocaleChoice,
} from "@/lib/i18n/locale-detect";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("country header → locale", () => {
  it("uses mainland China for 中文", () => {
    const cn = headers({ "cf-ipcountry": "CN" });
    expect(countryFromHeaders(cn)).toBe("CN");
    expect(detectLocaleFromHeaders(cn)).toBe("zh");
    expect(isMainlandChina("cn")).toBe(true);
  });

  it("treats other countries as English, including Greater China outside the mainland", () => {
    for (const code of ["US", "MY", "HK", "MO", "TW", "SG", "JP", "T1", "XX"]) {
      expect(localeFromCountry(code)).toBe("en");
      expect(detectLocaleFromHeaders(headers({ "cf-ipcountry": code }))).toBe("en");
    }
  });

  it("treats a missing country header as global English", () => {
    expect(countryFromHeaders(headers({}))).toBeNull();
    expect(detectLocaleFromHeaders(headers({}))).toBe("en");
    expect(detectLocaleFromHeaders(headers({ "accept-language": "zh-CN,zh;q=0.9" }))).toBe("en");
  });

  it("reads Cloudflare first and falls back to the Vercel country header", () => {
    expect(
      countryFromHeaders(headers({ "cf-ipcountry": "CN", "x-vercel-ip-country": "US" })),
    ).toBe("CN");
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "de" }))).toBe("DE");
    expect(detectLocaleFromHeaders(headers({ "x-vercel-ip-country": "CN" }))).toBe("zh");
  });
});

describe("stored language toggle wins over a later IP", () => {
  it("keeps the saved choice when the next request comes from another country", () => {
    const storage: { value: string | null } = { value: null };

    function visit(country: string | null) {
      return resolveLocale(storage.value, localeFromCountry(country));
    }

    expect(visit("CN")).toBe("zh");
    expect(visit("US")).toBe("en");
    expect(visit(null)).toBe("en");

    storage.value = "zh";
    expect(visit("US")).toBe("zh");
    expect(visit(null)).toBe("zh");

    storage.value = "en";
    expect(visit("CN")).toBe("en");
  });

  it("ignores values that are not the 中文 or English toggle", () => {
    expect(resolveLocale("ms", "zh")).toBe("zh");
    expect(resolveLocale("", "en")).toBe("en");
    expect(resolveLocale(null, "zh")).toBe("zh");
  });

  it("writes storage for the toggle only, not for a lang query", () => {
    expect(storesLocaleChoice("toggle")).toBe(true);
    expect(storesLocaleChoice("query")).toBe(false);
  });
});
