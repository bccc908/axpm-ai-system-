import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AXPM AI Operations",
    short_name: "AXPM",
    description: "CRM, finance, WeChat, and AI assistant for AXPM",
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
  };
}
