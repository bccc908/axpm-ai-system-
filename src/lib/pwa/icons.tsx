import { ImageResponse } from "next/og";

/** Kayden Chiew app icons. Rendered once at build time (routes are force-static). */
export const PWA_ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-192.png": { size: 192, maskable: true },
  "maskable-512.png": { size: 512, maskable: true },
  "favicon-32.png": { size: 32, maskable: false },
} as const;

export type PwaIconFile = keyof typeof PWA_ICONS;

export function isPwaIconFile(name: string): name is PwaIconFile {
  return Object.prototype.hasOwnProperty.call(PWA_ICONS, name);
}

/** maskable: full-bleed background, letters inside the 80% safe zone. */
export function renderKcIcon(size: number, maskable: boolean): ImageResponse {
  const inner = maskable ? size * 0.6 : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1d4ed8 0%, #0a0f1a 100%)",
          borderRadius: maskable ? 0 : Math.round(size * 0.1875),
        }}
      >
        <div
          style={{
            fontSize: Math.round(inner * 0.42),
            fontWeight: 800,
            color: "white",
            letterSpacing: -Math.round(inner * 0.015),
          }}
        >
          KC
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    },
  );
}
