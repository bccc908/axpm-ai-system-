import type { MetadataRoute } from "next";
import { PUBLIC_BRAND, PUBLIC_DESCRIPTION } from "@/lib/brand/public-brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PUBLIC_BRAND,
    short_name: "Kayden",
    description: PUBLIC_DESCRIPTION,
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
