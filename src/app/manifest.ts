import type { MetadataRoute } from "next";
import { PUBLIC_BRAND, PUBLIC_DESCRIPTION } from "@/lib/brand/public-brand";

export const PWA_THEME_COLOR = "#111521";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PUBLIC_BRAND,
    short_name: PUBLIC_BRAND,
    description: PUBLIC_DESCRIPTION,
    lang: "en",
    dir: "ltr",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: PWA_THEME_COLOR,
    theme_color: PWA_THEME_COLOR,
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
