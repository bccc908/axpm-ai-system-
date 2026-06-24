import { isOriginAllowed } from "@/lib/widget/config";

export function widgetCorsHeaders(origin: string | null, allowedOrigins: string[]) {
  const allowed = isOriginAllowed(origin, allowedOrigins);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  if (allowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (allowed && !origin) {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}
