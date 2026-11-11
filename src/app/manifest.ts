import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AXPM",
    short_name: "AXPM",
    description: "CRM、财务、微信与 AI 助手 — AXPM",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#111521",
    theme_color: "#111521",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    id: "/",
  };
}
