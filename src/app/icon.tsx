import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Tab icon: the lockup PNG, not a generated gradient. */
export default async function Icon() {
  const png = await readFile(join(process.cwd(), "public/brand/favicon-kd-32.png"));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
