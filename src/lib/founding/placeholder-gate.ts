/**
 * Strict placeholder gate. Rendered HTML that matches any marker must not go live.
 * Keep in sync with scripts/placeholder-markers.mjs (a test checks this).
 */
export const PLACEHOLDER_MARKERS: { name: string; re: RegExp }[] = [
  { name: 'class="ph"', re: /class="ph[\s"]/ },
  { name: "[TBD]", re: /\[TBD/i },
  { name: "[URL]", re: /\[URL\]/i },
  { name: "[Year]", re: /\[Year\]/i },
  { name: "【待定】", re: /【待定/ },
  { name: "待确认", re: /待确认/ },
  { name: "TODO-COPY", re: /TODO-COPY/ },
  { name: "lorem", re: /lorem/i },
  { name: "{{PLACEHOLDER}}", re: /\{\{\s*[A-Za-z_]+\s*\}\}/ },
];

export function findPlaceholderMarkers(html: string): string[] {
  return PLACEHOLDER_MARKERS.filter((m) => m.re.test(html)).map((m) => m.name);
}
