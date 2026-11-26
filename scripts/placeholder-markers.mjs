// Keep in sync with src/lib/founding/placeholder-gate.ts (a vitest test checks this).
export const PLACEHOLDER_MARKERS = [
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
