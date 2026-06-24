import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
    "undici",
    "sharp",
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

export default nextConfig;
