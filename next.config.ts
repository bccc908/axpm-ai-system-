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
};

export default nextConfig;
