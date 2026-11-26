import { renderKcIcon } from "@/lib/pwa/icons";

export const dynamic = "force-static";

/** iOS home-screen icon: square, full-bleed (iOS rounds the corners itself). */
export function GET() {
  return renderKcIcon(180, true);
}
