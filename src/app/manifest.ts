import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grok Trading",
    short_name: "Grok Trading",
    description: "CRM、财务、微信与 AI 助手 — Grok Trading",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#3b82f6",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    id: "/",
  };
}
