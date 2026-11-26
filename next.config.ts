import type { NextConfig } from "next";
import { execFileSync } from "child_process";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
    "undici",
    "sharp",
    "@napi-rs/canvas",
    "@ffmpeg-installer/ffmpeg",
    "edge-tts-universal",
  ],
  async headers() {
    const raw =
      process.env.WIDGET_ALLOWED_ORIGINS?.trim() ||
      "https://www.axpmprimecn.com,https://axpmprimecn.com,http://localhost:3000,http://127.0.0.1:3000";
    const frameAncestors = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(" ");

    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/offline.html",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/widget/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

/**
 * Founding waitlist go-live guard: `next build` (including `npx next build` in the
 * zero-downtime deploy) fails if FOUNDING_WAITLIST_OPEN=true while the seller
 * placeholders, C-W1 or copy placeholders are unresolved. Flag OFF = preview build.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.FOUNDING_PREFLIGHT_PASSED) {
    execFileSync(process.execPath, ["scripts/founding-preflight.mjs"], { stdio: "inherit" });
    process.env.FOUNDING_PREFLIGHT_PASSED = "1";
  }
  return nextConfig;
}
