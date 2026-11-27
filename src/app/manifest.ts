import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KD",
    short_name: "KD",
    description: "CRM、财务、微信与 AI 助手 — KD",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#111521",
    theme_color: "#111521",
    orientation: "portrait-primary",
    icons: [
      { src: "/brand/favicon-kd.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/favicon-kd-32.png", sizes: "32x32", type: "image/png", purpose: "any" },
      { src: "/brand/favicon-kd-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/brand/favicon-kd-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    id: "/",
  };
}
