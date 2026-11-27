import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon: the lockup PNG. */
export default async function AppleIcon() {
  const png = await readFile(join(process.cwd(), "public/brand/favicon-kd-180.png"));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
