#!/usr/bin/env node
// Strict placeholder gate for rendered pages. Exit 1 if any page contains a marker.
// Run against the CANDIDATE build before any deploy that makes /founding public
// (turning FOUNDING_WAITLIST_OPEN on, or removing noindex):
//   npm run start   # in another shell, on the candidate build
//   npm run gate:placeholders -- http://127.0.0.1:3000 /founding "/founding?lang=zh"
import { PLACEHOLDER_MARKERS } from "./placeholder-markers.mjs";

const [base = "http://127.0.0.1:3000", ...paths] = process.argv.slice(2);
const targets = paths.length ? paths : ["/founding", "/founding?lang=zh"];
let failed = false;
for (const p of targets) {
  const url = new URL(p, base).toString();
  let html;
  try {
    const res = await fetch(url, { redirect: "manual" });
    html = await res.text();
    if (res.status !== 200) {
      console.error(`FAIL ${url}: HTTP ${res.status}`);
      failed = true;
      continue;
    }
  } catch (err) {
    console.error(`FAIL ${url}: ${err.message}`);
    failed = true;
    continue;
  }
  const hits = PLACEHOLDER_MARKERS.filter((m) => m.re.test(html)).map((m) => m.name);
  const brand = /axpm/i.test(html);
  if (hits.length || brand) {
    failed = true;
    const counts = PLACEHOLDER_MARKERS.map((m) => [m.name, (html.match(new RegExp(m.re.source, m.re.flags.includes("g") ? m.re.flags : m.re.flags + "g")) || []).length]).filter(([, n]) => n);
    console.error(`FAIL ${url}: ${[...hits, ...(brand ? ["internal brand"] : [])].join(", ")}`);
    console.error(`     counts: ${counts.map(([n, c]) => `${n}=${c}`).join(" ")}`);
  } else {
    console.log(`PASS ${url}`);
  }
}
if (failed) {
  console.error("Placeholder gate FAILED: this page must not go live.");
  process.exit(1);
}
console.log("Placeholder gate passed.");
