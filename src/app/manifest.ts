import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "信号旗 AI 运营系统",
    short_name: "信号旗",
    description: "CRM、财务、微信与 AI 助手 — Signal Flag Operations",
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
