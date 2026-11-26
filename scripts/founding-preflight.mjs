#!/usr/bin/env node
// Build-time guard (runs before `next build`). If the founding waitlist flag is ON,
// the build FAILS unless C-W1 is recorded, every seller value is filled, and the copy
// has no unresolved ph(...) placeholder. With the flag OFF (default) the page builds
// as a noindex PREVIEW that stores nothing, so the build passes.
import { readFileSync } from "fs";
import { PLACEHOLDER_MARKERS } from "./placeholder-markers.mjs";

const env = process.env;
if (env.FOUNDING_WAITLIST_OPEN !== "true") {
  console.log("[founding-preflight] FOUNDING_WAITLIST_OPEN is off: /founding builds as a preview (stores nothing).");
  process.exit(0);
}
const problems = [];
if (env.FOUNDING_CW1_CLEARED !== "true") problems.push("FOUNDING_CW1_CLEARED is not true (lawyer EN+BM notice not live)");
for (const k of ["LEGAL_NAME", "REG_NO", "ADDRESS"].map((s) => `FOUNDING_SELLER_${s}`).concat(["FOUNDING_SUPPORT_EMAIL", "FOUNDING_PRIVACY_URL", "FOUNDING_TERMS_URL"])) {
  const v = (env[k] ?? "").trim();
  if (!v || PLACEHOLDER_MARKERS.some((m) => m.re.test(v))) problems.push(`${k} is not filled`);
}
const copy = readFileSync(new URL("../src/lib/founding/copy.ts", import.meta.url), "utf8");
const phCount = (copy.match(/\bph\("/g) || []).length;
if (phCount) problems.push(`${phCount} unresolved ph("...") copy placeholders in src/lib/founding/copy.ts`);
if (problems.length) {
  console.error("[founding-preflight] FAILED: /founding cannot go live:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("[founding-preflight] passed. Still run `npm run gate:placeholders` on the started build before deploy.");
